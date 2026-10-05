"""Test env. Settings are read at import time, so these must be set before app.* imports.

These are hard overrides, not setdefault: a shell or backend/.env that holds the real
DATABASE_URL or provider keys must never reach the test run. No test makes a network call
to a third-party API; anything that would is replaced with a fake in the test itself.

Postgres-backed tests run only when WTW_TEST_DATABASE_URL points at a throwaway local
database (CI starts a postgres service for this). They are skipped otherwise.
"""
import os
from urllib.parse import urlparse

import pytest

TEST_DATABASE_URL = os.environ.get("WTW_TEST_DATABASE_URL", "")

if TEST_DATABASE_URL:
    _host = urlparse(TEST_DATABASE_URL.replace("+asyncpg", "")).hostname or ""
    if _host not in {"localhost", "127.0.0.1", "postgres"}:
        raise RuntimeError(
            f"WTW_TEST_DATABASE_URL must point at a local throwaway database, got host {_host!r}"
        )

os.environ.update({
    # Port 1 is never listening, so a test that touches the DB without opting in fails fast.
    "DATABASE_URL": TEST_DATABASE_URL or "postgresql+asyncpg://wtw:wtw@127.0.0.1:1/wtw_unused",
    "CRON_SECRET": "test-cron-secret",
    "IP_HASH_SALT": "test-salt",
    "INTERNAL_PROXY_SECRET": "test-proxy-secret",
    "ENVIRONMENT": "test",
    "RATE_LIMIT_WHITELIST": "",
    # llm.py refuses to import without a key. The client is built but never called.
    "LLM_PROVIDER": "deepseek",
    "DEEPSEEK_API_KEY": "test-key",
    "OPENAI_API_KEY": "",
    "SERPER_API_KEY": "",
    "SERPER_API_KEY_FALLBACK": "",
    "SERPER_API_KEY_FALLBACK_2": "",
    "TMDB_API_KEY": "",
    "OMDB_API_KEY": "",
    "MDBLIST_API_KEY": "",
    "KINOCHECK_API_KEY": "",
    "GUARDIAN_API_KEY": "",
    "NYT_API_KEY": "",
    "WATCHMODE_API_KEY": "",
    "JINA_API_KEY": "",
    "RESEND_API_KEY": "",
})

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="set WTW_TEST_DATABASE_URL to a local Postgres to run database tests",
)


@pytest.fixture
async def db_schema():
    """Fresh schema per test, created the way the app creates it at startup (init_db)."""
    from sqlalchemy import text

    from app.database import engine, init_db
    import app.models  # noqa: F401  registers every table on Base.metadata

    # Also clears tables the frontend owns (users, …) that some tests create by hand.
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await init_db()
    yield engine
    # Each test runs on its own event loop; pooled asyncpg connections can't cross loops.
    await engine.dispose()
