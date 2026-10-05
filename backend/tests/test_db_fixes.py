"""Postgres-backed checks for the code-review fixes that read or write the database.

Run against a throwaway local Postgres (see conftest.requires_db). The schema is created
with init_db(), the same call the app makes at startup.
"""
from datetime import datetime, timedelta

import httpx
import pytest
from fastapi import HTTPException
from sqlalchemy import func, select, text

from conftest import requires_db

pytestmark = requires_db


class _FakeRequest:
    def __init__(self, headers=None, ip="203.0.113.7"):
        self.headers = headers or {}
        self.cookies = {}
        self.client = type("C", (), {"host": ip})()


def _proxy_headers(actor_type="user", actor_id="user-1", client_ip="198.51.100.20"):
    return {
        "x-wtw-proxy-secret": "test-proxy-secret",
        "x-wtw-actor-type": actor_type,
        "x-wtw-actor-id": actor_id,
        "x-wtw-client-ip": client_ip,
    }


async def _add_rate_rows(limit_type: str, n: int, key: str = "someone-else"):
    from app.database import async_session
    from app.models import RateLimitEntry

    async with async_session() as db:
        now = datetime.utcnow()
        for _ in range(n):
            db.add(RateLimitEntry(ip_hash=key, limit_type=limit_type, created_at=now))
        await db.commit()


async def _count_rate_rows() -> int:
    from app.database import async_session
    from app.models import RateLimitEntry

    async with async_session() as db:
        return (await db.execute(select(func.count()).select_from(RateLimitEntry))).scalar()


# ─── Global daily cap counts only the limit types that opt in ───────────────────────

async def test_roulette_rows_do_not_consume_the_generation_budget(db_schema, monkeypatch):
    from app.middleware import rate_limit

    monkeypatch.setattr(rate_limit.settings, "DAILY_GENERATION_LIMIT", 3)
    monkeypatch.setattr(rate_limit.settings, "HOURLY_GLOBAL_LIMIT", 1000)
    await _add_rate_rows("roulette", 10)

    # Ten roulette spins must not block a generation.
    await rate_limit.check_rate_limit(_FakeRequest(), "generation")

    await _add_rate_rows("generation", 3)
    with pytest.raises(HTTPException) as exc:
        await rate_limit.check_rate_limit(_FakeRequest(ip="203.0.113.99"), "generation")
    assert exc.value.detail["type"] == "global_daily_limit"


async def test_verified_actor_cannot_skip_the_global_hourly_cap(db_schema, monkeypatch):
    from app.middleware import rate_limit

    monkeypatch.setattr(rate_limit.settings, "HOURLY_GLOBAL_LIMIT", 5)
    await _add_rate_rows("battle", 5)

    with pytest.raises(HTTPException) as exc:
        await rate_limit.check_rate_limit_hybrid(
            _FakeRequest(headers=_proxy_headers()), "battle"
        )
    assert exc.value.detail["type"] == "global_hourly_limit"
    # A refused request must not be recorded.
    assert await _count_rate_rows() == 5


async def test_verified_actor_records_exactly_one_row(db_schema):
    from app.middleware import rate_limit

    await rate_limit.check_rate_limit_hybrid(_FakeRequest(headers=_proxy_headers()), "battle")
    assert await _count_rate_rows() == 1


# ─── Fallback review upserts instead of violating the unique movie_id ───────────────

async def test_fallback_review_updates_an_existing_review(db_schema, monkeypatch):
    from app.database import async_session
    from app.models import Movie, Review
    from app.schemas import LLMReviewOutput
    from app.services import pipeline

    async def fake_synthesize(**kwargs):
        return LLMReviewOutput(review_text="Fresh take.", verdict="WORTH IT")

    monkeypatch.setattr(pipeline, "synthesize_review", fake_synthesize)

    async with async_session() as db:
        movie = Movie(tmdb_id=550, title="Fight Club", media_type="movie")
        db.add(movie)
        await db.flush()
        db.add(Review(movie_id=movie.id, verdict="MIXED BAG", review_text="Old take."))
        await db.commit()

        await pipeline._create_fallback_review(db, movie, genres="Drama")
        await db.commit()

    async with async_session() as db:
        rows = (await db.execute(select(Review))).scalars().all()
    assert len(rows) == 1
    assert rows[0].review_text == "Fresh take."
    assert rows[0].verdict == "WORTH IT"
    assert rows[0].confidence == "LOW"


# ─── Feedback identity comes from the proxy, never the client ───────────────────────

async def _seed_review(tmdb_id=603):
    from app.database import async_session
    from app.models import Movie, Review

    async with async_session() as db:
        movie = Movie(tmdb_id=tmdb_id, title="The Matrix", media_type="movie")
        db.add(movie)
        await db.flush()
        db.add(Review(movie_id=movie.id, verdict="WORTH IT", review_text="Yes."))
        await db.commit()


def _client():
    from app.main import app

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_feedback_ignores_a_client_supplied_user_id(db_schema):
    from app.database import async_session
    from app.models import ReviewFeedback

    await _seed_review()
    async with _client() as client:
        # user_id in the body and the query string must both be ignored.
        r = await client.post(
            "/api/reviews/603/feedback?user_id=victim",
            json={"helpful": True, "user_id": "victim"},
        )
        assert r.status_code == 200

    async with async_session() as db:
        row = (await db.execute(select(ReviewFeedback))).scalar_one()
    assert row.user_id is None


async def test_feedback_uses_the_proxy_signed_user(db_schema):
    from app.database import async_session
    from app.models import ReviewFeedback

    await _seed_review()
    async with _client() as client:
        r = await client.post(
            "/api/reviews/603/feedback", json={"helpful": False}, headers=_proxy_headers()
        )
        assert r.status_code == 200
        assert r.json()["user_vote"] is False

    async with async_session() as db:
        row = (await db.execute(select(ReviewFeedback))).scalar_one()
    assert row.user_id == "user-1"


# ─── Battle cache is keyed by media type ────────────────────────────────────────────

async def test_battle_cache_is_not_served_across_media_types(db_schema, monkeypatch):
    from app.database import async_session
    from app.models import BattleCache
    from app.routers import versus

    async with async_session() as db:
        db.add(BattleCache(
            movie_a_id=100, movie_b_id=200, movie_a_type="movie", movie_b_type="movie",
            winner_id=100, loser_id=200, result_json={"cached": "movie-vs-movie"},
        ))
        await db.commit()

    async def no_movie(db, tmdb_id, media_type):
        return {}, None

    monkeypatch.setattr(versus, "_get_movie_data", no_movie)

    async with _client() as client:
        hit = await client.post("/api/versus/battle?movie_a_id=200&movie_b_id=100")
        assert hit.json() == {"cached": "movie-vs-movie"}

        miss = await client.post(
            "/api/versus/battle?movie_a_id=100&movie_b_id=200&movie_b_type=tv",
            headers=_proxy_headers(),
        )
        # Not served from the movie/movie cache; it went on to look the titles up.
        assert miss.status_code == 404


# ─── Digest commits per recipient ───────────────────────────────────────────────────

async def test_digest_marks_each_recipient_before_the_next_send(db_schema, monkeypatch):
    from app.database import async_session
    from app.jobs import email_digest

    async with async_session() as db:
        await db.execute(text(
            "CREATE TABLE users (id UUID PRIMARY KEY, email TEXT, "
            "digest_frequency VARCHAR(10) DEFAULT 'monthly', last_digest_sent_at TIMESTAMP)"
        ))
        await db.execute(text(
            "INSERT INTO users (id, email) VALUES "
            "('00000000-0000-0000-0000-000000000001', 'a@example.com'), "
            "('00000000-0000-0000-0000-000000000002', 'b@example.com')"
        ))
        await db.commit()

    async def fake_picks(db, since, limit):
        return [{"tmdb_id": 1, "title": "X", "media_type": "movie"}]

    async def fake_breakout(db, exclude_ids):
        return None

    sends = []

    async def fake_send(to, subject, html, headers=None):
        sends.append(to)
        if len(sends) == 2:
            raise RuntimeError("process killed mid-loop")
        return True

    monkeypatch.setattr(email_digest, "_get_picks", fake_picks)
    monkeypatch.setattr(email_digest, "_get_breakout", fake_breakout)
    monkeypatch.setattr(email_digest, "_render_html", lambda *a, **k: "<p>x</p>")
    monkeypatch.setattr(email_digest, "send_email", fake_send)

    async with async_session() as db:
        with pytest.raises(RuntimeError):
            await email_digest.run_digest(db, period="monthly")

    async with async_session() as db:
        marked = (await db.execute(text(
            "SELECT email FROM users WHERE last_digest_sent_at IS NOT NULL"
        ))).scalars().all()
    assert marked == [sends[0]]
