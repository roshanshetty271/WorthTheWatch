"""robots.txt is honoured before fetching an article, cached per origin, and fails open."""
import asyncio

import httpx
import pytest

from app.services import jina, net_guard

PAGE = "<html><body><article>" + "".join(
    f"<p>Paragraph {i}: the acting is brilliant and the film's direction is superb, a must watch.</p>"
    for i in range(20)
) + "</article></body></html>"


@pytest.fixture
def web(monkeypatch):
    """Fake internet: public DNS for every host, canned responses per URL, request log."""
    routes, log = {}, []

    async def fake_resolve(host, port):
        return ["93.184.216.34"]

    def handler(request):
        url = str(request.url)
        log.append(url)
        route = routes.get(url, (404, ""))
        if isinstance(route, Exception):
            raise route
        status, body = route
        return httpx.Response(status, text=body)

    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return real_client(*args, **kwargs)

    monkeypatch.setattr(net_guard, "_resolve", fake_resolve)
    monkeypatch.setattr(jina.httpx, "AsyncClient", client_factory)
    return routes, log


async def test_disallowed_page_is_never_requested(web):
    routes, log = web
    routes["https://critic.example/robots.txt"] = (200, "User-agent: *\nDisallow: /private/\n")
    routes["https://critic.example/private/review"] = (200, PAGE)

    reader = jina.ArticleReader()
    assert await reader._fetch_and_parse("https://critic.example/private/review") is None
    assert "https://critic.example/private/review" not in log


async def test_allowed_page_is_fetched(web):
    routes, log = web
    routes["https://critic.example/robots.txt"] = (200, "User-agent: *\nDisallow: /private/\n")
    routes["https://critic.example/reviews/matrix"] = (200, PAGE)

    reader = jina.ArticleReader()
    assert await reader._fetch_and_parse("https://critic.example/reviews/matrix")


async def test_rules_for_our_agent_are_applied(web):
    routes, _ = web
    routes["https://critic.example/robots.txt"] = (
        200, "User-agent: WorthTheWatch\nDisallow: /\n\nUser-agent: *\nAllow: /\n"
    )
    routes["https://critic.example/reviews/matrix"] = (200, PAGE)

    reader = jina.ArticleReader()
    assert await reader._fetch_and_parse("https://critic.example/reviews/matrix") is None


@pytest.mark.parametrize("robots", [
    (404, ""),                                  # no robots.txt
    (503, ""),                                  # server error
    httpx.ConnectError("boom"),                 # network failure
    httpx.ReadTimeout("slow"),                  # timeout
])
async def test_robots_failures_fail_open(web, robots):
    routes, _ = web
    routes["https://critic.example/robots.txt"] = robots
    routes["https://critic.example/reviews/matrix"] = (200, PAGE)

    reader = jina.ArticleReader()
    assert await reader._fetch_and_parse("https://critic.example/reviews/matrix")


async def test_robots_is_fetched_once_per_origin_even_in_a_burst(web):
    routes, log = web
    routes["https://critic.example/robots.txt"] = (200, "User-agent: *\nAllow: /\n")
    urls = [f"https://critic.example/reviews/{i}" for i in range(4)]
    for u in urls:
        routes[u] = (200, PAGE)

    reader = jina.ArticleReader()
    await asyncio.gather(*(reader._fetch_and_parse(u) for u in urls))
    await reader._fetch_and_parse(urls[0])  # later call is served from the cache

    assert log.count("https://critic.example/robots.txt") == 1
    assert all(u in log for u in urls)
