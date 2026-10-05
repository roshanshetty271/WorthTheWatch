"""In-memory job claims: one job per title, released on every exit path."""
import asyncio
import time

import httpx
import pytest
from sqlalchemy import select

from conftest import requires_db


@pytest.fixture(autouse=True)
def _clean_jobs():
    from app.services.pipeline import job_progress

    job_progress.clear()
    yield
    job_progress.clear()


def test_a_title_can_only_be_claimed_once():
    from app.services.pipeline import claim_job

    assert claim_job(1) is True
    assert claim_job(1) is False


def test_failed_and_stale_claims_can_be_reclaimed():
    from app.services import pipeline

    pipeline.fail_job(1, "boom")
    assert pipeline.claim_job(1) is True

    pipeline.job_progress[2] = {
        "message": "Reading articles...", "percent": 30,
        "started_at": time.monotonic() - pipeline.JOB_STALE_AFTER_SECONDS - 1,
    }
    assert pipeline.claim_job(2) is True


class _Movie:
    tmdb_id = 42


async def test_pipeline_releases_its_own_claim_when_it_raises(monkeypatch):
    """Cron and batch callers don't claim. A failure mid-pipeline used to leave
    {"message": "Reading articles..."} behind and wedge the title for users."""
    from app.services import pipeline

    async def boom(db, movie):
        assert pipeline.job_is_active(pipeline.job_progress.get(42))
        raise RuntimeError("serper down")

    monkeypatch.setattr(pipeline, "_generate_review_for_movie", boom)
    with pytest.raises(RuntimeError):
        await pipeline.generate_review_for_movie(None, _Movie())
    assert 42 not in pipeline.job_progress


async def test_pipeline_leaves_a_callers_claim_alone(monkeypatch):
    from app.services import pipeline

    async def ok(db, movie):
        return "review"

    monkeypatch.setattr(pipeline, "_generate_review_for_movie", ok)
    assert pipeline.claim_job(42)
    await pipeline.generate_review_for_movie(None, _Movie())
    assert pipeline.job_is_active(pipeline.job_progress.get(42))


async def test_background_task_releases_only_after_commit(monkeypatch):
    from app.routers import search
    from app.services import pipeline

    seen_at_commit = []

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def commit(self):
            seen_at_commit.append(pipeline.job_is_active(pipeline.job_progress.get(7)))

        async def rollback(self):
            pass

    async def fake_get_or_create(db, tmdb_id, media_type):
        return _Movie()

    async def fake_generate(db, movie):
        return None

    monkeypatch.setattr(search, "async_session", FakeSession)
    monkeypatch.setattr(search, "get_or_create_movie", fake_get_or_create)
    monkeypatch.setattr(search, "generate_review_for_movie", fake_generate)

    assert pipeline.claim_job(7)
    await search._generate_review_background(7)
    assert seen_at_commit == [True]
    assert 7 not in pipeline.job_progress


@pytest.mark.parametrize("exc", [RuntimeError("llm down"), asyncio.CancelledError()])
async def test_background_task_marks_failure_on_any_exit(monkeypatch, exc):
    from app.routers import search
    from app.services import pipeline

    class FakeSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *e):
            return False

        async def rollback(self):
            pass

    async def failing(db, tmdb_id, media_type):
        raise exc

    monkeypatch.setattr(search, "async_session", FakeSession)
    monkeypatch.setattr(search, "get_or_create_movie", failing)

    assert pipeline.claim_job(8)
    with pytest.raises(type(exc)) if isinstance(exc, asyncio.CancelledError) else _noraise():
        await search._generate_review_background(8)
    assert pipeline.job_progress[8]["failed"] is True
    assert pipeline.claim_job(8) is True  # a retry is allowed


class _noraise:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _client():
    from app.main import app

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


@requires_db
async def test_regenerate_is_not_reported_complete_with_the_old_review(db_schema, monkeypatch):
    from app.database import async_session
    from app.models import Movie, Review
    from app.routers import search
    from app.services import pipeline

    async with async_session() as db:
        movie = Movie(tmdb_id=603, title="The Matrix", media_type="movie")
        db.add(movie)
        await db.flush()
        db.add(Review(movie_id=movie.id, verdict="WORTH IT", review_text="Old."))
        await db.commit()

    async def not_started_yet(tmdb_id, media_type="movie"):
        return None

    monkeypatch.setattr(search, "_generate_review_background", not_started_yet)

    async with _client() as client:
        r = await client.post("/api/search/regenerate/603")
        assert r.json()["status"] == "regenerating"
        status = (await client.get("/api/search/status/603")).json()
        assert status["status"] == "generating"

        pipeline.release_job(603)  # what the task does after committing
        status = (await client.get("/api/search/status/603")).json()
        assert status["status"] == "completed"


@requires_db
async def test_generate_releases_the_claim_when_recording_usage_fails(db_schema, monkeypatch):
    from app.routers import search
    from app.services import pipeline

    async def no_details(tmdb_id):
        return {}

    async def quota_ok(actor_type, actor_id):
        return {"exhausted": False}

    async def not_blocked(ip_hash):
        return {"blocked": False}

    async def record_fails(*a, **k):
        raise RuntimeError("db hiccup")

    monkeypatch.setattr(search.tmdb_service, "get_movie_details", no_details)
    monkeypatch.setattr(search, "check_generation_quota", quota_ok)
    monkeypatch.setattr(search, "check_ip_abuse_guard", not_blocked)
    monkeypatch.setattr(search, "record_generation_usage", record_fails)

    headers = {
        "x-wtw-proxy-secret": "test-proxy-secret",
        "x-wtw-actor-type": "anon",
        "x-wtw-actor-id": "a1",
    }
    async with _client() as client:
        with pytest.raises(RuntimeError, match="db hiccup"):
            await client.post("/api/search/generate/604", headers=headers)
    assert 604 not in pipeline.job_progress


@requires_db
async def test_failed_job_is_reported_by_status(db_schema):
    from app.services import pipeline

    pipeline.fail_job(605, "Failed: Review generation encountered an error")
    async with _client() as client:
        status = (await client.get("/api/search/status/605")).json()
    assert status["status"] == "failed"


async def test_stream_hands_off_to_polling_instead_of_timing_out(monkeypatch):
    """A job still running when the stream closes must not be reported as timed out."""
    from app.routers import search
    from app.services import pipeline

    async def no_sleep(_):
        return None

    monkeypatch.setattr(search.asyncio, "sleep", no_sleep)
    assert pipeline.claim_job(606)

    response = await search.stream_generation_status(606, db=None)
    events = [chunk async for chunk in response.body_iterator]

    assert '"still_working"' in events[-1]
    assert not any('"error"' in e for e in events)
