"""Admin/cron secret: header-first, legacy query param still accepted but never logged."""
import logging

import httpx
import pytest


class _Req:
    def __init__(self, headers=None):
        self.headers = headers or {}
        self.url = type("U", (), {"path": "/api/cron/daily-tasks"})()


@pytest.mark.parametrize("headers", [
    {"x-admin-secret": "test-cron-secret"},
    {"authorization": "Bearer test-cron-secret"},
])
def test_header_forms_are_accepted(headers):
    from app.main import _admin_ok

    assert _admin_ok(_Req(headers)) is True


def test_legacy_query_param_still_works_but_warns_without_the_value(caplog):
    from app.main import _admin_ok

    with caplog.at_level(logging.WARNING):
        assert _admin_ok(_Req(), secret="test-cron-secret") is True
    assert "query parameter" in caplog.text
    assert "test-cron-secret" not in caplog.text


@pytest.mark.parametrize("headers,secret", [
    ({}, ""),
    ({"x-admin-secret": "wrong"}, ""),
    ({"authorization": "Bearer wrong"}, ""),
    ({"x-admin-secret": "tëst"}, ""),
])
def test_bad_or_missing_secret_is_refused(headers, secret):
    from app.main import _admin_ok

    assert _admin_ok(_Req(headers), secret=secret) is False


async def test_non_ascii_secret_is_a_403_not_a_500():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/api/admin/usage-stats", headers={"x-admin-secret": "tëst".encode("latin-1")})
    assert r.status_code == 403


def test_access_log_redacts_the_secret_query_value():
    from app.main import _RedactSecretQuery

    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 1,
        '%s - "%s %s HTTP/%s" %d',
        ("1.2.3.4:5", "GET", "/api/cron/digest?period=weekly&secret=s3cr3t&x=1", "1.1", 200),
        None,
    )
    assert _RedactSecretQuery().filter(record) is True
    line = record.getMessage()
    assert "s3cr3t" not in line
    assert "secret=[redacted]" in line
    assert "period=weekly" in line and "x=1" in line
