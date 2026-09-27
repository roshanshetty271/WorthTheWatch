"""Regression tests for the code-review batch.

Each test names the defect it pins down. These cover the pure-logic fixes — anything
requiring Postgres is deliberately out of scope here.
"""
import asyncio

import pytest


# ─── Finding 3: rate-limit identity must not come from a client cookie ──────────────

class _FakeRequest:
    def __init__(self, headers=None, cookies=None):
        self.headers = headers or {}
        self.cookies = cookies or {}


def test_raw_anon_cookie_is_not_accepted_as_identity():
    """A client-supplied wtw_anon_id used to mint a fresh rate-limit bucket per request."""
    from app.middleware.rate_limit import _get_actor_from_request

    req = _FakeRequest(cookies={"wtw_anon_id": "attacker-rotates-this"})
    assert _get_actor_from_request(req) == (None, None)


def test_proxy_signed_identity_is_accepted():
    from app.middleware.rate_limit import _get_actor_from_request

    req = _FakeRequest(headers={
        "x-wtw-proxy-secret": "test-proxy-secret",
        "x-wtw-actor-type": "user",
        "x-wtw-actor-id": "user-123",
    })
    assert _get_actor_from_request(req) == ("user", "user-123")


def test_wrong_proxy_secret_is_rejected():
    from app.middleware.rate_limit import _get_actor_from_request

    req = _FakeRequest(headers={
        "x-wtw-proxy-secret": "wrong",
        "x-wtw-actor-type": "user",
        "x-wtw-actor-id": "user-123",
    })
    assert _get_actor_from_request(req) == (None, None)


def test_unknown_actor_type_is_rejected():
    """actor_type picks which quota applies, so only known values may pass."""
    from app.middleware.rate_limit import _get_actor_from_request

    req = _FakeRequest(headers={
        "x-wtw-proxy-secret": "test-proxy-secret",
        "x-wtw-actor-type": "admin",
        "x-wtw-actor-id": "user-123",
    })
    assert _get_actor_from_request(req) == (None, None)


# ─── Finding 14: roulette must not consume the generation budget ────────────────────

def test_only_opted_in_types_count_toward_global_daily():
    from app.middleware.rate_limit import _GLOBAL_DAILY_TYPES

    assert "generation" in _GLOBAL_DAILY_TYPES
    assert "battle" in _GLOBAL_DAILY_TYPES
    assert "roulette" not in _GLOBAL_DAILY_TYPES


# ─── Finding 11: an empty TMDB payload must not KeyError ────────────────────────────

def test_normalize_result_raises_readable_error_on_empty_payload():
    from app.services.tmdb import tmdb_service

    with pytest.raises(ValueError, match="no id"):
        tmdb_service.normalize_result({})


def test_normalize_result_still_works_on_a_real_payload():
    from app.services.tmdb import tmdb_service

    out = tmdb_service.normalize_result({"id": 550, "title": "Fight Club", "media_type": "movie"})
    assert out["tmdb_id"] == 550
    assert out["title"] == "Fight Club"


# ─── Finding 9: articles must stay attached to the URL they came from ───────────────

async def test_read_urls_labels_articles_with_their_own_source():
    """Results arrive in completion order with failures dropped. Zipping the request list
    against the result list by index mislabelled every article after the first failure."""
    from app.services.jina import ArticleReader

    body = {
        "https://slow.example.com/a": ("SLOW " * 200, 0.05),
        "https://fast.example.com/b": ("FAST " * 200, 0.0),
        "https://broken.example.com/c": (None, 0.0),
    }

    reader = ArticleReader()

    async def fake_fetch(url, timeout=5.0):
        text, delay = body[url]
        if delay:
            await asyncio.sleep(delay)
        return text

    reader._fetch_and_parse = fake_fetch

    articles, failed = await reader.read_urls(list(body.keys()), timeout=5.0)

    # Every returned article must carry the URL that actually produced it.
    for url, text in articles:
        expected, _ = body[url]
        assert expected is not None, f"{url} returned no body but was kept"
        assert text == expected, f"{url} was labelled with another article's text"

    # The fast one finished first, so index-based pairing would have mislabelled it.
    assert ("https://fast.example.com/b", body["https://fast.example.com/b"][0]) in articles
    assert "https://broken.example.com/c" in failed


async def test_read_urls_keeps_reddit_attribution():
    """Reddit is fetched via old.reddit.com but must be labelled with the original URL,
    otherwise the pipeline buckets it as a critic publication."""
    from app.services.jina import ArticleReader

    reddit_url = "https://www.reddit.com/r/movies/comments/abc/great_film/"
    reader = ArticleReader()

    async def fake_fetch(url, timeout=5.0):
        return "REDDIT " * 200

    reader._fetch_and_parse = fake_fetch

    articles, _ = await reader.read_urls([reddit_url], timeout=5.0)

    assert articles, "expected the reddit thread to be returned"
    for url, _text in articles:
        assert "old.reddit.com" not in url
        assert url == reddit_url
