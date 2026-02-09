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
    "rogerebert.com", "nytimes.com",  # Always 403
    "wsj.com", "washingtonpost.com", "bloomberg.com",
    "newyorker.com", "wired.com",  # Paywall + block scrapers
]


class ArticleReader:
    """
    Reads articles from URLs. Two modes:
    - BeautifulSoup (default): Free forever, no API key needed
    - Jina Reader (optional): Better quality, needs API key + credits
    """

    def __init__(self):
        self.use_jina = settings.USE_JINA and bool(settings.JINA_API_KEY)
        if self.use_jina:
            logger.info("📖 Article Reader: Using Jina Reader API")
        else:
            logger.info("📖 Article Reader: Using BeautifulSoup (free mode)")

    async def read_url(self, url: str, timeout: float = 15.0) -> Optional[str]:
        """Read a single URL and return clean text content."""
        # Skip known problematic domains
        url_lower = url.lower()
        if any(domain in url_lower for domain in SKIP_DOMAINS + BLOCKED_DOMAINS):
            logger.debug(f"Skipping blocked domain: {url[:50]}...")
            return None

        if self.use_jina:
            return await self._read_with_jina(url, timeout)
        else:
            return await self._read_with_bs4(url, timeout)

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
                    logger.warning("Jina returned 402 — falling back to BeautifulSoup")
                    return await self._read_with_bs4(url, timeout)
            return None
        except Exception:
            return await self._read_with_bs4(url, timeout)

    async def _read_with_bs4(self, url: str, timeout: float) -> Optional[str]:
        """Read using httpx + BeautifulSoup. Free forever."""
        from bs4 import BeautifulSoup

        # Default headers that work for most sites
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }

        fetch_url = url
        is_reddit = "reddit.com" in url

        # Reddit: use old.reddit.com which works without JS
        if is_reddit and "old.reddit.com" not in url:
            fetch_url = url.replace("www.reddit.com", "old.reddit.com")
            # Handle URLs without www prefix
            if "old.reddit.com" not in fetch_url:
                fetch_url = fetch_url.replace("reddit.com", "old.reddit.com")
            logger.info(f"🔄 Reddit URL swapped: {url[:60]} → {fetch_url[:60]}")

        try:
            logger.debug(f"Fetching: {fetch_url}")
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers=headers,
            ) as client:
                resp = await client.get(fetch_url)

                # Retry with Safari User-Agent on 403
                if resp.status_code == 403:
                    headers["User-Agent"] = (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                        "Version/17.0 Safari/605.1.15"
                    )
                    resp = await client.get(fetch_url, headers=headers)

                if resp.status_code != 200:
                    logger.debug(f"BS4 got {resp.status_code} for {fetch_url[:50]}")
                    return None

                soup = BeautifulSoup(resp.text, "html.parser")

                # ─── Reddit-specific parsing ───────────────────────────
                if is_reddit or "old.reddit.com" in fetch_url:
                    comments = []
                    
                    # Post title
                    title_el = soup.find("a", class_="title")
                    if title_el:
                        comments.append(title_el.get_text(strip=True))
                    
                    # Post body (self text)
                    post_body = soup.find("div", class_="expando")
                    if post_body:
                        text = post_body.get_text(strip=True)
                        if len(text) > 30:
                            comments.append(text)
                    
                    # Comments from old.reddit.com
                    for comment in soup.find_all("div", class_="usertext-body"):
                        text = comment.get_text(strip=True)
                        if 50 < len(text) < 2000:
                            comments.append(text)
                    
                    result = "\n\n".join(comments[:30])  # Top 30 comments max
                    return result if len(result) > 200 else None

                # ─── Standard article parsing ──────────────────────────

                # Remove junk elements
                for tag in soup(["script", "style", "nav", "footer", "header",
                               "aside", "iframe", "noscript", "form", "button",
                               "svg", "figure", "figcaption"]):
                    tag.decompose()

                # Remove common ad/cookie/popup classes
                for selector in [".ad", ".ads", ".advertisement", ".cookie",
                               ".popup", ".modal", ".sidebar", ".newsletter",
                               ".social-share", ".related-posts", "#comments"]:
                    for el in soup.select(selector):
                        el.decompose()

                # Find main content area (priority order)
                main = (
                    soup.find("article") or
                    soup.find(class_=["post-content", "article-body", 
                                     "entry-content", "story-body", 
                                     "review-body", "article-content",
                                     "post-body", "content-body"]) or
                    soup.find("main") or
                    soup.find(id=["content", "main-content", "article-body"]) or
                    soup.find("body")
                )

                if not main:
                    return None

                # Extract text with paragraph separation
                paragraphs = []
                for p in main.find_all(["p", "h2", "h3", "blockquote", "li"]):
                    text = p.get_text(strip=True)
                    if len(text) > 30:
                        paragraphs.append(text)

                result = "\n\n".join(paragraphs)
                return result if len(result) > 200 else None

        except Exception as e:
            logger.debug(f"BS4 failed for {url[:50]}: {e}")
            return None

    async def read_urls(self, urls: list[str], max_concurrent: int = 5) -> list[str]:
        """Read multiple URLs in parallel."""
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _read(url: str) -> Optional[str]:
            async with semaphore:
                return await self.read_url(url)

        tasks = [_read(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        successful = [r for r in results if isinstance(r, str) and r]
        logger.info(f"📖 Read {len(successful)}/{len(urls)} articles successfully")
        return successful


# Keep the same variable name so nothing else needs to change
jina_service = ArticleReader()
