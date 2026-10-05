"""Rate limiter: atomic check-and-record, no raw IPs in logs, safe secret comparison."""
import asyncio
import logging

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from conftest import requires_db


class _FakeRequest:
    def __init__(self, headers=None, ip="203.0.113.7"):
        self.headers = headers or {}
        self.cookies = {}
        self.client = type("C", (), {"host": ip})()


def test_non_ascii_proxy_secret_is_rejected_not_a_500():
    """compare_digest raises TypeError on non-ASCII str; a junk header must just fail."""
    from app.middleware.rate_limit import _get_actor_from_request, _proxy_secret_ok

    req = _FakeRequest(headers={
        "x-wtw-proxy-secret": "tëst-proxy-secret",
        "x-wtw-actor-type": "user",
        "x-wtw-actor-id": "u",
    })
    assert _proxy_secret_ok(req) is False
    assert _get_actor_from_request(req) == (None, None)


async def _rows():
    from app.database import async_session
    from app.models import RateLimitEntry

    async with async_session() as db:
        return (await db.execute(select(func.count()).select_from(RateLimitEntry))).scalar()


async def _burst(coro_factory, n=5):
    results = await asyncio.gather(*(coro_factory() for _ in range(n)), return_exceptions=True)
    passed = [r for r in results if r is None]
    refused = [r for r in results if isinstance(r, HTTPException) and r.status_code == 429]
    assert len(passed) + len(refused) == n, results
    return len(passed)


@requires_db
async def test_concurrent_burst_from_one_ip_gets_exactly_the_limit(db_schema, monkeypatch):
    from app.middleware import rate_limit

    monkeypatch.setitem(rate_limit._LIMIT_MAP["generation"], "per_ip_per_hour", 1)
    req = _FakeRequest(ip="198.51.100.50")

    assert await _burst(lambda: rate_limit.check_rate_limit(req, "generation")) == 1
    assert await _rows() == 1


@requires_db
async def test_concurrent_burst_from_one_actor_gets_exactly_the_limit(db_schema, monkeypatch):
    from app.middleware import rate_limit

    monkeypatch.setitem(rate_limit._HYBRID_LIMITS["battle"], "anon_per_day", 2)
    req = _FakeRequest(headers={
        "x-wtw-proxy-secret": "test-proxy-secret",
        "x-wtw-actor-type": "anon",
        "x-wtw-actor-id": "anon-burst",
    })

    assert await _burst(lambda: rate_limit.check_rate_limit_hybrid(req, "battle")) == 2
    assert await _rows() == 2


@requires_db
async def test_raw_ip_and_forwarded_header_are_not_logged(db_schema, caplog):
    from app.middleware import rate_limit

    req = _FakeRequest(headers={"x-forwarded-for": "192.0.2.123, 192.0.2.250"})
    with caplog.at_level(logging.DEBUG):
        await rate_limit.check_rate_limit(req, "roulette")

    logged = "\n".join(r.getMessage() for r in caplog.records)
    assert "Rate limit check" in logged
    assert "192.0.2.123" not in logged
    assert "192.0.2.250" not in logged
    assert rate_limit._hash_ip("192.0.2.250") in logged
