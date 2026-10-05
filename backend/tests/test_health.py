"""/health stays DB-free liveness; /health/ready reports whether the database answers."""
import httpx

from conftest import requires_db


def _client():
    from app.main import app

    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test")


async def test_liveness_never_touches_the_database(monkeypatch):
    from app import main

    def no_db():
        raise AssertionError("/health must not open a database session")

    monkeypatch.setattr(main, "async_session", no_db)
    async with _client() as client:
        r = await client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


async def test_readiness_is_503_when_the_database_is_down(monkeypatch):
    from app import main

    class DownSession:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def execute(self, *a, **k):
            raise ConnectionRefusedError("database is suspended")

    monkeypatch.setattr(main, "async_session", DownSession)
    async with _client() as client:
        r = await client.get("/health/ready")
    assert r.status_code == 503
    assert r.json() == {"status": "unavailable", "database": "disconnected"}


@requires_db
async def test_readiness_is_200_when_the_database_answers(db_schema):
    async with _client() as client:
        r = await client.get("/health/ready")
    assert r.status_code == 200
    assert r.json() == {"status": "ready", "database": "connected"}
