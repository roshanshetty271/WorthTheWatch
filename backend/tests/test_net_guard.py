"""SSRF guard: every hop of a scraper fetch must resolve to a public address."""
import httpx
import pytest

from app.services import net_guard
from app.services.net_guard import UnsafeURLError, assert_public_url, safe_get

PUBLIC = "93.184.216.34"


@pytest.fixture
def dns(monkeypatch):
    """Fake resolver: hostname -> list of addresses. No real DNS lookups."""
    table = {}

    async def fake_resolve(host, port):
        if host not in table:
            raise OSError("NXDOMAIN")
        return table[host]

    monkeypatch.setattr(net_guard, "_resolve", fake_resolve)
    return table


@pytest.mark.parametrize("addr", [
    "127.0.0.1", "10.1.2.3", "172.16.0.5", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1%eth0", "fd00::1",
    "::ffff:127.0.0.1",
])
async def test_private_loopback_and_link_local_are_refused(dns, addr):
    dns["evil.example"] = [addr]
    with pytest.raises(UnsafeURLError):
        await assert_public_url("https://evil.example/review")


async def test_one_private_answer_among_public_ones_is_refused(dns):
    dns["mixed.example"] = [PUBLIC, "10.0.0.7"]
    with pytest.raises(UnsafeURLError):
        await assert_public_url("http://mixed.example/")


@pytest.mark.parametrize("url", [
    "http://127.0.0.1/admin", "http://[::1]:8000/", "http://169.254.169.254/latest/meta-data/",
    "file:///etc/passwd", "ftp://example.com/x", "http:///nohost",
])
async def test_literal_internal_hosts_and_other_schemes_are_refused(dns, url):
    with pytest.raises(UnsafeURLError):
        await assert_public_url(url)


async def test_public_host_is_allowed(dns):
    dns["critic.example"] = [PUBLIC]
    await assert_public_url("https://critic.example/review")


def _client(routes):
    """httpx client whose transport serves canned responses per URL."""
    def handler(request):
        status, headers, body = routes[str(request.url)]
        return httpx.Response(status, headers=headers, text=body)

    return httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=False)


async def test_redirect_to_a_private_address_is_refused(dns):
    dns["critic.example"] = [PUBLIC]
    dns["internal.example"] = ["10.0.0.5"]
    routes = {
        "https://critic.example/r": (302, {"location": "http://internal.example/secret"}, ""),
        "http://internal.example/secret": (200, {}, "SECRET"),
    }
    async with _client(routes) as client:
        with pytest.raises(UnsafeURLError):
            await safe_get(client, "https://critic.example/r")


async def test_redirect_to_metadata_ip_literal_is_refused(dns):
    dns["critic.example"] = [PUBLIC]
    routes = {"https://critic.example/r": (301, {"location": "http://169.254.169.254/"}, "")}
    async with _client(routes) as client:
        with pytest.raises(UnsafeURLError):
            await safe_get(client, "https://critic.example/r")


async def test_public_redirect_chain_is_followed(dns):
    dns["a.example"] = [PUBLIC]
    dns["b.example"] = [PUBLIC]
    routes = {
        "https://a.example/1": (301, {"location": "https://b.example/2"}, ""),
        "https://b.example/2": (302, {"location": "/3"}, ""),  # relative hop
        "https://b.example/3": (200, {}, "the article"),
    }
    async with _client(routes) as client:
        resp = await safe_get(client, "https://a.example/1")
    assert resp.status_code == 200 and resp.text == "the article"


async def test_redirect_loops_are_capped(dns):
    dns["loop.example"] = [PUBLIC]
    routes = {"https://loop.example/": (302, {"location": "https://loop.example/"}, "")}
    async with _client(routes) as client:
        with pytest.raises(UnsafeURLError, match="redirects"):
            await safe_get(client, "https://loop.example/")


async def test_scraper_returns_nothing_for_a_private_target(dns, monkeypatch):
    """End to end through ArticleReader: the refused fetch is a plain miss, not a crash."""
    from app.services.jina import ArticleReader

    dns["localhost.example"] = ["127.0.0.1"]
    reader = ArticleReader()
    assert await reader._fetch_and_parse("http://localhost.example/review") is None
