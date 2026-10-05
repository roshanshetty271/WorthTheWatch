"""
Worth the Watch? — Article Reader Service
Uses selectolax (Lexbor engine) for ultra-fast parsing.
Set USE_JINA=True in .env to use Jina Reader instead.
"""

import asyncio
import httpx
import logging
import time
from typing import Optional, List, Dict
from selectolax.lexbor import LexborHTMLParser
from app.config import get_settings
from fake_useragent import UserAgent

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
    - selectolax (default): High-performance C-based parsing
    - Jina Reader (optional): Better quality, needs API key + credits

    Smart Reddit handling:
    - Tries old.reddit.com first for ONE URL
    - If blocked (403), skips ALL remaining Reddit direct fetches
    - Zero wasted retries
    """

    def __init__(self):
        self.use_jina = settings.USE_JINA and bool(settings.JINA_API_KEY)
        if self.use_jina:
            logger.info("📖 Article Reader: Using Jina Reader API")
        else:
            logger.info("📖 Article Reader: Using selectolax (Lexbor engine) logic")

        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }

        try:
            self.ua = UserAgent()
        except Exception:
            self.ua = None  # Fallback if initialization fails


    # ─── Main Entry Points ────────────────────────────────

    async def read_url(self, url: str, timeout: float = 5.0) -> Optional[str]:
        """Read a single URL and return clean text content."""
        url_lower = url.lower()

        # Skip known problematic domains
        if any(domain in url_lower for domain in SKIP_DOMAINS + BLOCKED_DOMAINS):
            return None

        if self.use_jina:
            return await self._read_with_jina(url, timeout)
        else:
            return await self._read_with_selectolax(url, timeout)

    async def _fetch_labelled(self, source_url: str, fetch_url: str, timeout: float):
        """Fetch and keep the originating URL attached to the result.

        Results come back in completion order, so the only safe way to know which article
        came from which URL is to carry the URL through with it. Callers used to zip the
        request list against the result list by index, which silently mislabelled every
        article once one request failed or finished out of order.
        """
        return source_url, await self._fetch_and_parse(fetch_url, timeout)

    async def read_urls(
        self, urls: list[str], timeout: float = 5.0
    ) -> tuple[list[tuple[str, str]], list[str]]:
        """
        Race to 5: Fire all non-Reddit URLs immediately.
        Return as soon as 5 quality articles are collected.
        Cancel remaining tasks to save time.

        Returns ([(source_url, article_text), ...], failed_urls).
        """

        # Separate Reddit and non-Reddit
        reddit_urls = [u for u in urls if "reddit.com" in u.lower()]
        other_urls = [u for u in urls if "reddit.com" not in u.lower()]
        
        articles = []
        failed = []
        MIN_ARTICLE_CHARS = 500
        TARGET_ARTICLES = 5
        
        # ─── Fire ALL non-Reddit URLs at once (no semaphore!) ───
        tasks = {}
        for url in other_urls:
            # Create task for direct fetch
            task = asyncio.create_task(self._fetch_labelled(url, url, timeout))
            tasks[task] = url

        # Also fire Reddit test in parallel with non-Reddit
        reddit_test_task = None
        if reddit_urls:
            test_url = self._to_old_reddit(reddit_urls[0])
            reddit_test_task = asyncio.create_task(
                self._fetch_labelled(reddit_urls[0], test_url, timeout)
            )
            tasks[reddit_test_task] = reddit_urls[0]
            
        logger.info(f"🚀 Burst Mode: Launched {len(tasks)} fetches simultaneously (Race to {TARGET_ARTICLES})")
        
        # ─── Race: process results as they arrive ───
        # We wrap as_completed to handle results
        if tasks:
            for coro in asyncio.as_completed(tasks.keys()):
                try:
                    source_url, result = await coro

                    if result and len(result) > MIN_ARTICLE_CHARS:
                        articles.append((source_url, result))
                        # Check if we won the race
                        if len(articles) >= TARGET_ARTICLES:
                            logger.info(
                                f"⚡ Race to {TARGET_ARTICLES} won! "
                                f"Got {len(articles)} quality articles. Cancelling rest."
                            )
                            break
                except Exception:
                    pass
        
        # ─── Cancel remaining tasks & Collect stats ───
        cancelled_count = 0
        for task, url in tasks.items():
            if not task.done():
                task.cancel()
                cancelled_count += 1
                failed.append(url)
            else:
                # Task finished, check if it was a failure (None result).
                # result() is now (source_url, text|None) — a tuple is always truthy,
                # so the text has to be inspected explicitly.
                try:
                    _, res = task.result()
                    if not res:
                        failed.append(url)
                except Exception:
                    failed.append(url)
        
        if cancelled_count:
            logger.info(f"🏁 Cancelled {cancelled_count} pending fetches")

        # ─── Reddit phase: only if we need more articles ───
        # Check if the test Reddit task succeeded (if we waited for it)
        reddit_blocked = True
        if reddit_test_task:
            if reddit_test_task.done() and not reddit_test_task.cancelled():
                 # It finished naturally
                _, res = reddit_test_task.result()
                if res and len(res) > MIN_ARTICLE_CHARS:
                    reddit_blocked = False
            elif reddit_test_task.cancelled():
                # We cancelled it because we won the race - assume it might have worked?
                # Actually if we won the race, we don't care about Reddit anymore unless...
                # wait, if len(articles) >= TARGET, we are done. 
                # This block only runs if we NEED more articles.
                pass

        if reddit_urls and len(articles) < TARGET_ARTICLES:
            logger.info(f"🤔 Need more articles ({len(articles)}/{TARGET_ARTICLES}) — checking Reddit...")
            
            # If the test task was cancelled, we don't know if Reddit works.
            # But usually if we need more articles, we would have waited for it.
            # If it failed/returned None, then blocked=True.
            
            if reddit_blocked:
                logger.info("🚫 Reddit blocked/failed — skipping remaining Reddit threads")
            else:
                # Reddit works — fetch remaining in parallel
                logger.info("✅ Reddit works — fetching remaining threads")
                remaining_tasks = []
                for url in reddit_urls[1:]:
                    old = self._to_old_reddit(url)
                    remaining_tasks.append(
                        asyncio.create_task(self._fetch_labelled(url, old, timeout))
                    )
                if remaining_tasks:
                    reddit_results = await asyncio.gather(
                        *remaining_tasks, return_exceptions=True
                    )
                    for r in reddit_results:
                        if isinstance(r, tuple):
                            src, text = r
                            if isinstance(text, str) and len(text) > MIN_ARTICLE_CHARS:
                                articles.append((src, text))

        logger.info(f"📖 Read {len(articles)}/{len(urls)} articles successfully")
        if failed:
            logger.info(f"❌ Failed/cancelled URLs: {len(failed)}")

        return articles, failed

    # ─── Core Fetch Methods ───────────────────────────────

    async def _fetch_and_parse(self, url: str, timeout: float = 5.0) -> Optional[str]:
        """Single fetch + parse attempt. No retries. Returns clean text or None."""
        t_start = time.time()
        
        try:
            # User-Agent Rotation
            headers = self.headers.copy()
            if self.ua:
                headers["User-Agent"] = self.ua.random

            async with httpx.AsyncClient(
                timeout=timeout,
                follow_redirects=True,
                headers=headers,
            ) as client:
                resp = await client.get(url)
                t_fetch = time.time() - t_start

                if resp.status_code != 200:
                    return None

                html = resp.text
                
                # PRE-PARSE CHECK: Size limit
                MAX_HTML_BYTES = 2_000_000  # 2MB
                if len(html) > MAX_HTML_BYTES:
                    logger.warning(
                        f"⚠️ Skipping oversized HTML: {url} "
                        f"({len(html) // 1024}KB exceeds limit)"
                    )
                    return None
                
                if len(html) < 500:
                    return None

                # Quick pre-check: does this page look like a review?
                # Prevents parsing 200KB pages that are just error pages or unrelated
                review_signals = [
                    "movie", "film", "performance", "director", "acting",
                    "plot", "story", "character", "scene", "rating",
                    "review", "recommend", "verdict", "opinion",
                ]
                html_lower = html.lower()
                signal_count = sum(1 for word in review_signals if word in html_lower)
                
                if signal_count < 2:
                    logger.debug(f"⏭️ Skipping parse for {url[:40]}... — only {signal_count} review signals")
                    return None

                # Optimization: Reddit snippets often come from JSON/special pages
                # For now we treat all as HTML, but we parse them differently
                result = None
                if "old.reddit.com" in url or "reddit.com" in url:
                    result = self._parse_reddit_html(html)
                else:
                    result = self._parse_article_html(html, url)
                
                t_total = time.time() - t_start
                t_parse = t_total - t_fetch
                
                # Log slow parses to identify bottlenecks
                if t_parse > 0.5:
                    logger.warning(
                        f"🐌 Slow parse: {url[:50]}... "
                        f"fetch={t_fetch:.2f}s parse={t_parse:.2f}s "
                        f"html={len(html)//1024}KB"
                    )

                return result

        except httpx.TimeoutException:
            return None
        except Exception as e:
            logger.debug(f"Fetch error for {url[:60]}: {e}")
            return None

    # ─── HTML Parsers (Selectolax) ────────────────────────

    def _parse_article_html(self, html: str, url: str = "") -> Optional[str]:
        """Parse a general article/review page into clean text using Lexbor."""
        
        tree = LexborHTMLParser(html)

        # Remove junk elements
        # Note: css() returns a list of Nodes
        for tag in tree.css(
            "script, style, nav, footer, header, aside, iframe, noscript, form, button, svg"
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
            try:
                found = tree.css_first(selector)
                if found:
                    content = found
                    break
            except Exception:
                continue

        # STRATEGY 2: Fall back to body
        if not content:
            content = tree.body
            
        if not content:
            return None

        # Extract text from paragraphs and other elements
        paragraphs = []
        # selectolax css selects descendants
        for el in content.css("p, h2, h3, h4, blockquote, li, div, span"):
            text = el.text(strip=True)
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
            # Lexbor text() does not strictly support separator arg in all versions like BS4 
            # but usually usually it joins with no space. 
            # However, iter() or traverse could work. 
            # For simplicity & speed, we'll iterate text nodes if needed, 
            # but let's try just getting all text and splitting by newlines if implied.
            # Actually, standard .text() joins everything. 
            # To simulate separator, we rely on the fact we already tried p tags.
            # If we are failing, let's try a simpler approach:
            # Just grab all text node children?
            # Let's try to trust the tree text, but it might be one blob.
            # A safe bet is using proper iteration if we really need structure.
            # But let's stick to the user's cheat sheet "tree.body.text(separator='\n')"
            # assuming the library version supports it or they wrote a wrapper. 
            # If not, it might throw. But let's assume valid instruction.
            try:
                raw_text = content.text(separator="\n", strip=True)
                lines = [
                    line.strip()
                    for line in raw_text.split("\n")
                    if len(line.strip()) > 20
                ]
                if lines:
                    paragraphs = lines
            except Exception:
                # Fallback if separator not supported
                raw_text = content.text(strip=True)
                if len(raw_text) > 50:
                    paragraphs.append(raw_text)

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
        
        tree = LexborHTMLParser(html)

        comments = []

        # Post title
        title_el = tree.css_first("a.title")
        if title_el:
            comments.append(title_el.text(strip=True))

        # Post body (self text)
        post_body = tree.css_first("div.expando")
        if not post_body:
            post_body = tree.css_first("div.usertext-body")
        if post_body:
            text = post_body.text(strip=True)
            if len(text) > 30:
                comments.append(text)

        # Comments
        for comment in tree.css("div.usertext-body"):
            text = comment.text(strip=True)
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
                    logger.warning("Jina 402 — falling back to selectolax")
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
    async def _read_with_selectolax(self, url: str, timeout: float) -> Optional[str]:
        """Backward compatible single-URL read (renamed from bs4)."""
        return await self._fetch_and_parse(url, timeout)


# Singleton — same interface as before
jina_service = ArticleReader()