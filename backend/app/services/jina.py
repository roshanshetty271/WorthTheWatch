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
        """Read using httpx + BeautifulSoup. More aggressive content extraction."""
        from bs4 import BeautifulSoup
        
        # Default headers
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }

        try:
            fetch_url = url
            is_reddit = "reddit.com" in url.lower()
            
            # Reddit URL swap
            if is_reddit and "old.reddit.com" not in url:
                fetch_url = url.replace("www.reddit.com", "old.reddit.com")
                if "old.reddit.com" not in fetch_url:
                    fetch_url = fetch_url.replace("reddit.com", "old.reddit.com")
                logger.info(f"🔄 Reddit URL swapped: {url[:60]} → {fetch_url[:60]}")
            
            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers=headers,
            ) as client:
                resp = await client.get(fetch_url)
                
                # Handle Reddit 403 with retry / Google cache
                if resp.status_code == 403:
                    # Retry with Safari User-Agent
                    client.headers["User-Agent"] = (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                        "Version/17.0 Safari/605.1.15"
                    )
                    resp = await client.get(fetch_url)
                
                if resp.status_code != 200:
                    # Fallback for Reddit: Google Web Cache
                    if is_reddit:
                        original_url = url.replace("old.reddit.com", "www.reddit.com")
                        cache_url = f"https://webcache.googleusercontent.com/search?q=cache:{original_url}"
                        logger.info(f"🔄 Reddit blocked, trying Google cache: {url[:60]}")
                        try:
                            resp = await client.get(cache_url)
                            if resp.status_code == 200:
                                return self._parse_reddit_from_cache(resp.text)
                        except Exception as e:
                            logger.warning(f"Google cache fetch failed: {e}")
                    
                    return None
                
                html = resp.text
                if len(html) < 500:
                    return None
                
                soup = BeautifulSoup(html, "html.parser")
                
                # Remove junk elements
                for tag in soup(["script", "style", "nav", "footer", "header",
                               "aside", "iframe", "noscript", "form", "button",
                               "svg"]):
                    tag.decompose()
                
                # STRATEGY 1: Try targeted content selectors
                content = None
                
                # Try common article/content containers
                selectors = [
                    "article",
                    "[class*='article-body']",
                    "[class*='post-content']",
                    "[class*='entry-content']",
                    "[class*='story-body']",
                    "[class*='review-body']",
                    "[class*='article-content']",
                    "[class*='post-body']",
                    "[class*='content-body']",
                    "[class*='review-content']",
                    "[class*='main-content']",
                    "[class*='post_content']",
                    "[class*='blogpost']",
                    "[class*='single-content']",
                    "[id='content']",
                    "[id='main-content']",
                    "[id='article-body']",
                    "[role='main']",
                    "main",
                    ".post",
                    ".review",
                    ".entry",
                ]
                
                for selector in selectors:
                    found = soup.select_one(selector)
                    if found:
                        content = found
                        break
                
                # STRATEGY 2: If no container found, use body
                if not content:
                    content = soup.find("body")
                
                if not content:
                    return None
                
                # Extract ALL text paragraphs
                paragraphs = []
                for el in content.find_all(["p", "h2", "h3", "h4", 
                                            "blockquote", "li", "div", "span"]):
                    text = el.get_text(strip=True)
                    # Be LESS strict — accept shorter paragraphs
                    if len(text) > 20:
                        # Skip obvious navigation/UI text
                        skip_words = ["cookie", "subscribe", "sign up", "log in",
                                    "newsletter", "privacy policy", "terms of",
                                    "click here", "read more", "share this",
                                    "advertisement", "sponsored"]
                        if not any(sw in text.lower() for sw in skip_words):
                            paragraphs.append(text)
                
                # STRATEGY 3: If paragraphs are empty, just get ALL text
                if len(paragraphs) < 3:
                    # Fall back to raw text extraction
                    raw_text = content.get_text(separator="\n", strip=True)
                    # Split into lines and keep meaningful ones
                    lines = [line.strip() for line in raw_text.split("\n") 
                             if len(line.strip()) > 20]
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
                
                result = "\n\n".join(unique[:50])  # More paragraphs
                
                # Be LESS strict on minimum length
                if len(result) > 100:  # Was 200, now 100
                    return result
                
                # Log WHY parsing failed
                html_len = len(resp.text)
                para_count = len(paragraphs)
                result_len = len(result)
                logger.warning(
                    f"⚠️ Parse failed for {url[:60]}: "
                    f"HTML={html_len} chars, paragraphs={para_count}, "
                    f"extracted={result_len} chars"
                )
                return None
        
        except httpx.TimeoutException:
            return None
        except Exception as e:
            logger.debug(f"BS4 parse error for {url[:60]}: {e}")
            return None

    async def read_urls(self, urls: list[str], max_concurrent: int = 5) -> tuple[list[str], list[str]]:
        """
        Read multiple URLs in parallel.
        Returns (successful_articles, failed_urls).
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _read(url: str) -> tuple[str, Optional[str]]:
            async with semaphore:
                content = await self.read_url(url)
                return (url, content)

        tasks = [_read(url) for url in urls]
        # Use return_exceptions=True to prevent one failure from crashing all
        results = await asyncio.gather(*tasks, return_exceptions=True)

        articles = []
        failed = []
        
        for r in results:
            if isinstance(r, tuple):
                url, content = r
                if content:
                    articles.append(content)
                else:
                    failed.append(url)
            else:
                # Exception occurred (shouldn't happen with return_exceptions=True inside _read, but safe to handle)
                failed.append("unknown_error")
                logger.error(f"Error reading URL: {r}")

        logger.info(f"📖 Read {len(articles)}/{len(urls)} articles successfully")
        if failed:
            logger.info(f"❌ Failed URLs: {len(failed)}")
            
        return articles, failed

    def _parse_reddit_from_cache(self, html: str) -> Optional[str]:
        """Parse Reddit content from Google's cached HTML."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        
        # Remove Google's cache header/banner
        for div in soup.find_all("div", id="google-cache-hdr"):
            div.decompose()
        for div in soup.find_all("div", style=lambda s: s and "CACHE" in s.upper() if s else False):
            div.decompose()
        
        # Get ALL text content aggressively
        body = soup.find("body") or soup
        
        # Remove scripts, styles, nav
        for tag in body(["script", "style", "nav", "footer"]):
            tag.decompose()
        
        # Get raw text
        raw_text = body.get_text(separator="\n", strip=True)
        
        # Split into lines, keep meaningful ones
        lines = []
        for line in raw_text.split("\n"):
            line = line.strip()
            if len(line) > 30 and len(line) < 3000:
                # Skip Google cache UI text
                skip = ["cache", "google", "disclaimer", "snapshot", 
                       "log in", "sign up", "get the app", "reddit premium",
                       "user agreement", "privacy policy", "content policy"]
                if not any(s in line.lower() for s in skip):
                    lines.append(line)
        
        result = "\n\n".join(lines[:40])
        
        if len(result) > 100:
            return result
        return None


# Keep the same variable name so nothing else needs to change
jina_service = ArticleReader()
