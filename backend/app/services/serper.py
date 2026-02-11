"""
Worth the Watch? — Serper API Service
Searches Google for review articles and Reddit discussions.
Free tier: 2500 searches on signup.
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
        self.headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json",
        }

    async def search_images(self, query: str, num_results: int = 3) -> list[dict]:
        """Search Google Images via Serper. Returns list of {imageUrl, source, title}."""
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                resp = await client.post(
                    self.image_url,
                    headers=self.headers,
                    json={"q": query, "num": num_results},
                )

                if resp.status_code != 200:
                    logger.warning(f"Serper Images returned {resp.status_code}")
                    return []

                data = resp.json()
                return data.get("images", [])
                
        except Exception as e:
            logger.error(f"Serper image search failed: {e}")
            return []

    async def search(self, query: str, num_results: int = 10) -> list[dict]:
        """Search Google via Serper. Returns list of {title, link, snippet}."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.post(
                    self.url,
                    headers=self.headers,
                    json={"q": query, "num": num_results},
                )

                # Handle API limit errors
                if resp.status_code in (402, 429):
                    logger.warning("⚠️ Serper API limit reached! Rotate key or wait.")
                    return []

                # Handle server errors
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
                
                # Blocklist filter
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
            # Force "review opinion" to avoid streaming sites
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

