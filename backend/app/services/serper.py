"""
Worth the Watch? — Serper API Service
Searches Google for review articles and Reddit discussions.
Free tier: 2500 searches on signup.

Supports automatic key failover: when primary key hits 402/429,
switches to SERPER_API_KEY_FALLBACK for the rest of the session.
"""

import httpx
import logging
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class SerperService:
    BLOCKLIST = [
        "reelgood.com", "gatsby.tv", "moviefone.com", "streamin.co", 
        "freemoviescinema", "teepublic.com", "themoviedb.org", "imdb.com",
        "justwatch.com", "rottentomatoes.com", "metacritic.com", "simkl.com",
        "facebook.com", "instagram.com", "twitter.com", "tiktok.com", "youtube.com"
    ]

    def __init__(self):
        self.url = "https://google.serper.dev/search"
        self.image_url = "https://google.serper.dev/images"
        
        # Primary key
        self._primary_key = settings.SERPER_API_KEY
        # Fallback key (from second account)
        self._fallback_key = getattr(settings, "SERPER_API_KEY_FALLBACK", "")
        # Active key starts as primary
        self._active_key = self._primary_key
        # Track if we already switched
        self._switched_to_fallback = False

    def _get_headers(self) -> dict:
        return {
            "X-API-KEY": self._active_key,
            "Content-Type": "application/json",
        }

    def _switch_to_fallback(self) -> bool:
        """
        Switch to fallback key. Returns True if switch was successful,
        False if no fallback available or already switched.
        """
        if self._switched_to_fallback:
            logger.error("⛔ Both Serper keys exhausted. No more search credits.")
            return False
        
        if not self._fallback_key:
            logger.error("⛔ Primary Serper key exhausted and no SERPER_API_KEY_FALLBACK set.")
            return False
        
        self._active_key = self._fallback_key
        self._switched_to_fallback = True
        logger.warning("🔄 Switched to fallback Serper API key.")
        return True

    async def search_images(self, query: str, num_results: int = 3) -> list[dict]:
        """Search Google Images via Serper."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.post(
                    self.image_url,
                    headers=self._get_headers(),
                    json={"q": query, "num": num_results},
                )

                if resp.status_code in (402, 429):
                    if self._switch_to_fallback():
                        # Retry with fallback key
                        resp = await client.post(
                            self.image_url,
                            headers=self._get_headers(),
                            json={"q": query, "num": num_results},
                        )
                    else:
                        return []

                if resp.status_code != 200:
                    logger.warning(f"Serper Images returned {resp.status_code}")
                    return []

                data = resp.json()
                return data.get("images", [])
                
        except Exception as e:
            logger.error(f"Serper image search failed: {e}")
            return []

    async def search(self, query: str, num_results: int = 10) -> list[dict]:
        """Search Google via Serper with automatic key failover."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.post(
                    self.url,
                    headers=self._get_headers(),
                    json={"q": query, "num": num_results},
                )

                # Key exhausted — try fallback
                if resp.status_code in (402, 429):
                    logger.warning(f"⚠️ Serper key exhausted (HTTP {resp.status_code})")
                    if self._switch_to_fallback():
                        # Retry immediately with fallback key
                        resp = await client.post(
                            self.url,
                            headers=self._get_headers(),
                            json={"q": query, "num": num_results},
                        )
                        if resp.status_code in (402, 429):
                            logger.error("⛔ Fallback Serper key also exhausted.")
                            return []
                    else:
                        return []

                if resp.status_code >= 500:
                    logger.error(f"Serper server error: {resp.status_code}")
                    return []

                if resp.status_code != 200:
                    logger.warning(f"Serper returned {resp.status_code}")
                    return []

                try:
                    data = resp.json()
                except Exception:
                    logger.error("Serper returned invalid JSON")
                    return []

            results = []
            for item in data.get("organic", []):
                link = item.get("link", "")
                
                if any(blocked in link.lower() for blocked in self.BLOCKLIST):
                    continue
                    
                results.append({
                    "title": item.get("title", ""),
                    "link": link,
                    "snippet": item.get("snippet", ""),
                })
            return results

        except httpx.TimeoutException:
            logger.warning(f"Serper search timed out for: {query[:50]}")
            return []
        except Exception as e:
            logger.error(f"Serper search failed: {e}")
            return []

    async def search_reviews(self, title: str, year: str = "", media_type: str = "movie") -> list[dict]:
        """Search for critic review articles."""
        try:
            type_hint = "TV series" if media_type == "tv" else "movie"
            query = f'"{title}" {year} {type_hint} review opinion'.strip()
            return await self.search(query, num_results=20)
        except Exception as e:
            logger.error(f"search_reviews failed for '{title}': {e}")
            return []

    async def search_reddit(self, title: str, year: str = "", media_type: str = "movie") -> list[dict]:
        """Search Reddit discussions via Google."""
        try:
            type_hint = "TV show" if media_type == "tv" else "movie"
            query = f'"{title}" {year} {type_hint} reddit'.strip()
            return await self.search(query, num_results=15)
        except Exception as e:
            logger.error(f"search_reddit failed for '{title}': {e}")
            return []

    async def search_forums(self, title: str, year: str = "", media_type: str = "movie") -> list[dict]:
        """Search for forum discussions, blog posts, and user opinions."""
        try:
            type_hint = "TV show" if media_type == "tv" else "movie"
            query = f'"{title}" {year} {type_hint} review discussion opinions worth watching'.strip()
            return await self.search(query, num_results=10)
        except Exception as e:
            logger.error(f"search_forums failed for '{title}': {e}")
            return []


serper_service = SerperService()