"""
Worth the Watch? — Jina Reader Service
Converts any URL to clean markdown. Replaces BeautifulSoup entirely.
Free tier: 10M tokens (~5000 articles), 200 RPM with free API key.
"""

import asyncio
import logging
import httpx
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry, RetryExhausted

settings = get_settings()
logger = logging.getLogger(__name__)


class JinaService:
    def __init__(self):
        self.base = settings.JINA_BASE_URL
        self.headers = {"Accept": "text/markdown"}
        if settings.JINA_API_KEY:
            self.headers["Authorization"] = f"Bearer {settings.JINA_API_KEY}"

    async def read_url(self, url: str, timeout: float = 8.0) -> Optional[str]:
        """Read a single URL and return clean markdown content."""
        try:
            return await self._read_url_with_retry(url, timeout)
        except RetryExhausted:
            logger.warning(f"All retries exhausted for {url}")
            return None
        except Exception:
            return None

    @with_retry(max_retries=1, base_delay=0.5, timeout=8.0)
    async def _read_url_with_retry(self, url: str, timeout: float) -> Optional[str]:
        """Internal method with retry logic."""
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                f"{self.base}/{url}",
                headers=self.headers,
            )
            if resp.status_code == 200:
                content = resp.text
                # Basic sanity check — skip very short or error pages
                if len(content) > 100:
                    return content
            return None

    async def read_urls(self, urls: list[str], max_concurrent: int = 5) -> list[str]:
        """Read multiple URLs in parallel. Returns list of content strings."""
        semaphore = asyncio.Semaphore(max_concurrent)

        async def _read_with_semaphore(url: str) -> Optional[str]:
            async with semaphore:
                return await self.read_url(url)

        tasks = [_read_with_semaphore(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out None and exceptions
        articles = []
        for r in results:
            if isinstance(r, str) and r:
                articles.append(r)
        return articles


jina_service = JinaService()
