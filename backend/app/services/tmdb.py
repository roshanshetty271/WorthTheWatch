"""
Worth the Watch? — TMDB API Service
Handles movie metadata, trending, upcoming, search, and watch providers.
Free API, ~50 req/sec, no daily limit.
"""

import httpx
from datetime import date
from typing import Optional
from app.config import get_settings

settings = get_settings()

TMDB_HEADERS = {
    "Authorization": f"Bearer {settings.TMDB_API_KEY}",
    "accept": "application/json",
}


class TMDBService:
    def __init__(self):
        self.base = settings.TMDB_BASE_URL
        self.image_base = settings.TMDB_IMAGE_BASE

    async def _get(self, endpoint: str, params: dict = None) -> dict:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base}{endpoint}",
                headers=TMDB_HEADERS,
                params=params or {},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_trending(self, media_type: str = "all", time_window: str = "day", page: int = 1) -> list[dict]:
        """Get trending movies/tv. media_type: 'all', 'movie', 'tv'"""
        data = await self._get(f"/trending/{media_type}/{time_window}", {"page": page})
        return data.get("results", [])

    async def get_now_playing(self, page: int = 1) -> list[dict]:
        """Movies currently in theaters."""
        data = await self._get("/movie/now_playing", {"page": page})
        return data.get("results", [])

    async def get_upcoming(self, page: int = 1) -> list[dict]:
        """Movies coming soon — for pre-computation."""
        data = await self._get("/movie/upcoming", {"page": page})
        return data.get("results", [])

    async def get_popular_tv(self, page: int = 1) -> list[dict]:
        """Popular TV shows."""
        data = await self._get("/tv/popular", {"page": page})
        return data.get("results", [])

    async def get_movie_details(self, tmdb_id: int) -> dict:
        """Full movie details."""
        return await self._get(f"/movie/{tmdb_id}")

    async def get_tv_details(self, tmdb_id: int) -> dict:
        """Full TV show details."""
        return await self._get(f"/tv/{tmdb_id}")

    async def search(self, query: str, page: int = 1) -> list[dict]:
        """Multi-search across movies and TV."""
        data = await self._get("/search/multi", {"query": query, "page": page})
        results = data.get("results", [])
        # Filter to only movies and tv
        return [r for r in results if r.get("media_type") in ("movie", "tv")]

    async def get_watch_providers(self, tmdb_id: int, media_type: str = "movie", region: str = "US") -> dict:
        """
        Get streaming/rent/buy availability from TMDB (JustWatch data).
        FREE - no extra API needed!
        
        Returns:
            {
                "flatrate": [{"provider_name": "Netflix", "logo_path": "...", "provider_id": 8}],
                "rent": [...],
                "buy": [...],
                "free": [...],
                "link": "https://www.themoviedb.org/movie/123/watch"
            }
        """
        endpoint = f"/{media_type}/{tmdb_id}/watch/providers"
        try:
            data = await self._get(endpoint)
            results = data.get("results", {})
            
            # Get region-specific data (default US)
            region_data = results.get(region, results.get("US", {}))
            
            return {
                "flatrate": region_data.get("flatrate", []),  # Subscription (Netflix, etc)
                "rent": region_data.get("rent", []),          # Rent options
                "buy": region_data.get("buy", []),            # Purchase options
                "free": region_data.get("free", []),          # Free with ads (Tubi, etc)
                "ads": region_data.get("ads", []),            # Free with ads
                "link": region_data.get("link", ""),          # JustWatch link
            }
        except Exception:
            return {"flatrate": [], "rent": [], "buy": [], "free": [], "ads": [], "link": ""}

    def get_poster_url(self, path: Optional[str], size: str = "w500") -> Optional[str]:
        if not path:
            return None
        return f"{self.image_base}/{size}{path}"

    def get_backdrop_url(self, path: Optional[str], size: str = "w1280") -> Optional[str]:
        if not path:
            return None
        return f"{self.image_base}/{size}{path}"

    def normalize_result(self, item: dict) -> dict:
        """Normalize TMDB result to our schema."""
        media_type = item.get("media_type", "movie")
        title = item.get("title") or item.get("name", "Unknown")
        release = item.get("release_date") or item.get("first_air_date")
        poster_path = item.get("poster_path")
        backdrop_path = item.get("backdrop_path")

        return {
            "tmdb_id": item["id"],
            "title": title,
            "original_title": item.get("original_title") or item.get("original_name"),
            "media_type": media_type,
            "overview": item.get("overview"),
            "poster_path": poster_path,
            "backdrop_path": backdrop_path,
            "poster_url": self.get_poster_url(poster_path),
            "backdrop_url": self.get_backdrop_url(backdrop_path),
            "genres": item.get("genres") or [
                {"id": gid} for gid in (item.get("genre_ids") or [])
            ],
            "release_date": release,
            "tmdb_popularity": item.get("popularity"),
            "tmdb_vote_average": item.get("vote_average"),
            "tmdb_vote_count": item.get("vote_count"),
        }


tmdb_service = TMDBService()
