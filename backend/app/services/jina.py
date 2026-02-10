"""
Worth the Watch? — Article Reader Service
Uses BeautifulSoup by default (free forever).
Set USE_JINA=True in .env to use Jina Reader instead.
"""

import asyncio
import httpx
import logging
from typing import Optional
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Domains that won't work with simple scraping — skip them entirely
SKIP_DOMAINS = [
    "youtube.com", "youtu.be", "twitter.com", "x.com",
    "instagram.com", "tiktok.com", "facebook.com",
]

# Domains that block scrapers — skip to save time
BLOCKED_DOMAINS = [
    "imdb.com", "rottentomatoes.com", "letterboxd.com",
    "rogerebert.com", "nytimes.com",
    "wsj.com", "washingtonpost.com", "bloomberg.com",
    "newyorker.com", "wired.com",
]


class ArticleReader:
    """
    Reads articles from URLs. Two modes:
    - BeautifulSoup (default): Free forever, no API key needed
    - Jina Reader (optional): Better quality, needs API key + credits

    Smart Reddit handling:
    - Tries old.reddit.com first for ONE URL
    - If blocked (403), skips ALL remaining Reddit direct fetches
    - Falls back to Google cache for Reddit content
    - Zero wasted retries
    """

    def __init__(self):
        self.use_jina = settings.USE_JINA and bool(settings.JINA_API_KEY)
        if self.use_jina:
            logger.info("📖 Article Reader: Using Jina Reader API")
        else:
            logger.info("📖 Article Reader: Using BeautifulSoup (free mode)")

        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }
        
        self._google_cache_blocked = False

    # ─── Main Entry Points ────────────────────────────────

    async def read_url(self, url: str, timeout: float = 8.0) -> Optional[str]:
        """Read a single URL and return clean text content."""
        url_lower = url.lower()

        # Skip known problematic domains
        if any(domain in url_lower for domain in SKIP_DOMAINS + BLOCKED_DOMAINS):
            return None

        if self.use_jina:
            return await self._read_with_jina(url, timeout)
        else:
            return await self._read_with_bs4(url, timeout)

    async def read_urls(self, urls: list[str], max_concurrent: int = 5, timeout: float = 8.0) -> tuple[list[str], list[str]]:
        """
        Read multiple URLs with smart Reddit handling.

        Strategy:
        1. Separate Reddit URLs from non-Reddit URLs
        2. Fetch all non-Reddit URLs in parallel (they always work)
        3. Test ONE Reddit URL to check if blocked
        4. If Reddit works → fetch remaining Reddit in parallel
        5. If Reddit blocked → Google cache for all Reddit URLs
        
        This avoids wasting 15-20 seconds on 7 parallel Reddit 403s.
        """
        # Separate Reddit and non-Reddit URLs
        self._google_cache_blocked = False  # Reset for each batch
        reddit_urls = [u for u in urls if "reddit.com" in u.lower()]
        other_urls = [u for u in urls if "reddit.com" not in u.lower()]

        articles = []
        failed = []

        # ─── Step 1: Fetch non-Reddit URLs in parallel (always works) ───
        if other_urls:
            semaphore = asyncio.Semaphore(max_concurrent)

            async def _read(url: str) -> tuple[str, Optional[str]]:
                async with semaphore:
                    content = await self.read_url(url, timeout=timeout)
                    return (url, content)

            tasks = [_read(url) for url in other_urls]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, tuple):
                    url, content = r
                    if content:
                        articles.append(content)
                    else:
                        failed.append(url)
                else:
                    failed.append("unknown_error")

        # ─── Step 2: Handle Reddit URLs smartly ───
        if reddit_urls:
            reddit_articles, reddit_failed = await self._read_reddit_urls(
                reddit_urls, max_concurrent, timeout=timeout
            )
            articles.extend(reddit_articles)
            failed.extend(reddit_failed)

        logger.info(f"📖 Read {len(articles)}/{len(urls)} articles successfully")
        if failed:
            logger.info(f"❌ Failed URLs: {len(failed)}")

        return articles, failed

    # ─── Reddit Smart Handler ─────────────────────────────

    async def _read_reddit_urls(
        self, urls: list[str], max_concurrent: int = 5, timeout: float = 8.0
    ) -> tuple[list[str], list[str]]:
        """
        Smart Reddit fetching:
        1. Try old.reddit.com for the FIRST URL only
        2. If it works → fetch the rest via old.reddit.com in parallel
        3. If blocked → skip direct fetch, use Google cache for ALL
        """
        if not urls:
            return [], []

        articles = []
        failed = []

        # Test first Reddit URL to see if old.reddit.com works
        test_url = urls[0]
        old_url = self._to_old_reddit(test_url)

        logger.info(f"🔍 Testing Reddit access with: {old_url[:60]}...")
        test_result = await self._fetch_and_parse(old_url, timeout=timeout)

        if test_result:
            # Reddit works! Fetch all remaining in parallel via old.reddit.com
            logger.info("✅ Reddit accessible — fetching all threads via old.reddit.com")
            articles.append(test_result)

            if len(urls) > 1:
                semaphore = asyncio.Semaphore(max_concurrent)
                remaining = urls[1:]

                async def _read_reddit(url: str) -> tuple[str, Optional[str]]:
                    async with semaphore:
                        old = self._to_old_reddit(url)
                        content = await self._fetch_and_parse(old, timeout=timeout)
                        # If individual URL fails, try cache for just that one
                        if not content:
                            content = await self._fetch_google_cache(url, timeout=timeout)
                        return (url, content)

                tasks = [_read_reddit(u) for u in remaining]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for r in results:
                    if isinstance(r, tuple):
                        url, content = r
                        if content:
                            articles.append(content)
                        else:
                            failed.append(url)
                    else:
                        failed.append("unknown_error")
        else:
            # Reddit is BLOCKED — skip direct fetch entirely
            logger.warning(
                f"🚫 Reddit blocked on this server — "
                f"using Google cache for {len(urls)} URLs"
            )
            failed.append(test_url)

            # Try Google cache for ALL Reddit URLs in parallel
            semaphore = asyncio.Semaphore(max_concurrent)

            async def _cache_reddit(url: str) -> tuple[str, Optional[str]]:
                async with semaphore:
                    if self._google_cache_blocked:
                        logger.debug("⏭️ Google Cache rate limited — skipping")
                        return (url, None)
                        
                    content = await self._fetch_google_cache(url, timeout=timeout)
                    return (url, content)

            tasks = [_cache_reddit(u) for u in urls[1:]]  # Skip test URL (already failed)
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, tuple):
                    url, content = r
                    if content:
                        articles.append(content)
                    else:
                        failed.append(url)
                else:
                    failed.append("unknown_error")

        return articles, failed

    # ─── Core Fetch Methods ───────────────────────────────

    async def _fetch_and_parse(self, url: str, timeout: float = 8.0) -> Optional[str]:
        """Single fetch + parse attempt. No retries. Returns clean text or None."""
        from bs4 import BeautifulSoup

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers=self.headers,
            ) as client:
                resp = await client.get(url)

                if resp.status_code != 200:
                    return None

                html = resp.text
                if len(html) < 500:
                    return None

                # Reddit-specific parsing for old.reddit.com
                if "old.reddit.com" in url or "reddit.com" in url:
                    return self._parse_reddit_html(html)

                # General article parsing
                return self._parse_article_html(html, url)

        except httpx.TimeoutException:
            return None
        except Exception as e:
            logger.debug(f"Fetch error for {url[:60]}: {e}")
            return None

    async def _fetch_google_cache(self, url: str, timeout: float = 8.0) -> Optional[str]:
        """Fetch Reddit content via Google's web cache."""
        # Normalize to www.reddit.com for cache lookup
        original = url.replace("old.reddit.com", "www.reddit.com")
        if "www.reddit.com" not in original and "reddit.com" in original:
            original = original.replace("reddit.com", "www.reddit.com")

        cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{original}"

        try:
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers=self.headers,
            ) as client:
                resp = await client.get(cache_url)

                # Detect rate limiting (302 → 429 pattern)
                if resp.status_code == 429:
                    if not self._google_cache_blocked:
                        self._google_cache_blocked = True
                        logger.warning("⚠️ Google Cache rate limited — skipping remaining")
                    return None
                
                if resp.status_code == 302:
                    redirect_url = str(resp.headers.get("location", ""))
                    if "sorry" in redirect_url.lower() or "google.com/sorry" in redirect_url.lower():
                        if not self._google_cache_blocked:
                            self._google_cache_blocked = True
                            logger.warning("⚠️ Google Cache rate limited (302→sorry) — skipping remaining")
                        return None

                if resp.status_code == 200 and len(resp.text) > 500:
                    return self._parse_reddit_from_cache(resp.text)
        except Exception:
            pass
        return None

    # ─── HTML Parsers ─────────────────────────────────────

    def _parse_article_html(self, html: str, url: str = "") -> Optional[str]:
        """Parse a general article/review page into clean text."""
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Remove junk elements
        for tag in soup(
            ["script", "style", "nav", "footer", "header",
             "aside", "iframe", "noscript", "form", "button", "svg"]
        ):
            tag.decompose()

        # STRATEGY 1: Find the main content container
        content = None
        selectors = [
            "article",
            "[class*='article-body']", "[class*='post-content']",
            "[class*='entry-content']", "[class*='story-body']",
            "[class*='review-body']", "[class*='article-content']",
            "[class*='post-body']", "[class*='content-body']",
            "[class*='review-content']", "[class*='main-content']",
            "[class*='post_content']", "[class*='blogpost']",
            "[class*='single-content']",
            "[id='content']", "[id='main-content']", "[id='article-body']",
            "[role='main']", "main", ".post", ".review", ".entry",
        ]

        for selector in selectors:
            found = soup.select_one(selector)
            if found:
                content = found
                break

        # STRATEGY 2: Fall back to body
        if not content:
            content = soup.find("body")

        if not content:
            return None

        # Extract text from paragraphs and other elements
        paragraphs = []
        for el in content.find_all(
            ["p", "h2", "h3", "h4", "blockquote", "li", "div", "span"]
        ):
            text = el.get_text(strip=True)
            if len(text) > 20:
                skip_words = [
                    "cookie", "subscribe", "sign up", "log in",
                    "newsletter", "privacy policy", "terms of",
                    "click here", "read more", "share this",
                    "advertisement", "sponsored",
                ]
                if not any(sw in text.lower() for sw in skip_words):
                    paragraphs.append(text)

        # STRATEGY 3: Raw text fallback
        if len(paragraphs) < 3:
            raw_text = content.get_text(separator="\n", strip=True)
            lines = [
                line.strip()
                for line in raw_text.split("\n")
                if len(line.strip()) > 20
            ]
            if lines:
                paragraphs = lines

        # Deduplicate
        seen = set()
        unique = []
        for p in paragraphs:
            key = p[:80].lower()
            if key not in seen:
                seen.add(key)
                unique.append(p)

        result = "\n\n".join(unique[:50])

        if len(result) > 100:
            return result

        # Debug: log parse failure
        logger.warning(
            f"⚠️ Parse failed for {url[:60]}: "
            f"HTML={len(html)} chars, paragraphs={len(paragraphs)}, "
            f"extracted={len(result)} chars"
        )
        return None

    def _parse_reddit_html(self, html: str) -> Optional[str]:
        """Parse Reddit old.reddit.com HTML for comments and post content."""
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        comments = []

        # Post title
        title_el = soup.find("a", class_="title")
        if title_el:
            comments.append(title_el.get_text(strip=True))

        # Post body (self text)
        post_body = soup.find("div", class_="expando")
        if not post_body:
            post_body = soup.find("div", class_="usertext-body")
        if post_body:
            text = post_body.get_text(strip=True)
            if len(text) > 30:
                comments.append(text)

        # Comments
        for comment in soup.find_all("div", class_="usertext-body"):
            text = comment.get_text(strip=True)
            if 50 < len(text) < 2000:
                comments.append(text)

        # Deduplicate
        seen = set()
        unique = []
        for c in comments:
            key = c[:80].lower()
            if key not in seen:
                seen.add(key)
                unique.append(c)

        result = "\n\n".join(unique[:30])
        return result if len(result) > 100 else None

    def _parse_reddit_from_cache(self, html: str) -> Optional[str]:
        """Parse Reddit content from Google's cached HTML."""
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "html.parser")

        # Remove Google's cache header
        for div in soup.find_all("div", id="google-cache-hdr"):
            div.decompose()
        for div in soup.find_all(
            "div",
            style=lambda s: s and "CACHE" in s.upper() if s else False,
        ):
            div.decompose()

        body = soup.find("body") or soup

        # Remove junk
        for tag in body(["script", "style", "nav", "footer"]):
            tag.decompose()

        # Get raw text
        raw_text = body.get_text(separator="\n", strip=True)

        lines = []
        skip = [
            "cache", "google", "disclaimer", "snapshot",
            "log in", "sign up", "get the app", "reddit premium",
            "user agreement", "privacy policy", "content policy",
        ]

        for line in raw_text.split("\n"):
            line = line.strip()
            if 30 < len(line) < 3000:
                if not any(s in line.lower() for s in skip):
                    lines.append(line)

        # Deduplicate
        seen = set()
        unique = []
        for line in lines:
            key = line[:80].lower()
            if key not in seen:
                seen.add(key)
                unique.append(line)

        result = "\n\n".join(unique[:40])
        return result if len(result) > 100 else None

    # ─── Jina Reader (optional) ───────────────────────────

    async def _read_with_jina(self, url: str, timeout: float) -> Optional[str]:
        """Read using Jina Reader API."""
        try:
            headers = {"Accept": "text/markdown"}
            if settings.JINA_API_KEY:
                headers["Authorization"] = f"Bearer {settings.JINA_API_KEY}"

            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    f"https://r.jina.ai/{url}",
                    headers=headers,
                )
                if resp.status_code == 200 and len(resp.text) > 100:
                    return resp.text
                if resp.status_code == 402:
                    logger.warning("Jina 402 — falling back to BeautifulSoup")
                    return await self._fetch_and_parse(url)
            return None
        except Exception:
            return await self._fetch_and_parse(url)

    # ─── Utilities ────────────────────────────────────────

    @staticmethod
    def _to_old_reddit(url: str) -> str:
        """Convert any reddit.com URL to old.reddit.com."""
        result = url.replace("www.reddit.com", "old.reddit.com")
        if "old.reddit.com" not in result:
            result = result.replace("reddit.com", "old.reddit.com")
        return result

    # Keep backward compatibility — single URL read still works
    async def _read_with_bs4(self, url: str, timeout: float) -> Optional[str]:
        """Backward compatible single-URL read."""
        return await self._fetch_and_parse(url, timeout)


# Singleton — same interface as before
jina_service = ArticleReader()