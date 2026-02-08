"""
Worth the Watch? — KinoCheck API Service
Fetches official movie trailers from KinoCheck.
Free tier: 1000 requests/day.
"""

import httpx
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()


class KinoCheckService:
    """KinoCheck API client for fetching movie trailers."""
    
    BASE_URL = "https://api.kinocheck.com"

    def __init__(self):
        self.api_key = getattr(settings, "KINOCHECK_API_KEY", "")

    def _get_headers(self) -> dict:
        """Build API headers with proper authentication."""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Api-Key": self.api_key,
            "X-Api-Host": "api.kinocheck.com",
        }

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_trailer_by_tmdb_id(
        self, tmdb_id: int, media_type: str = "movie", language: str = "en"
    ) -> Optional[str]:
        """
        Fetch official trailer YouTube ID from KinoCheck.
        
        Args:
            tmdb_id: TMDB movie/show ID
            media_type: 'movie' or 'tv'
            language: ISO language code (default: 'en')
            
        Returns:
            YouTube video ID (e.g., 'dQw4w9WgXcQ') or None
        """
        if not self.api_key:
            return None

        # Use /shows for TV, /movies for films
        endpoint = "/shows" if media_type == "tv" else "/movies"
        params = {"tmdb_id": tmdb_id, "language": language, "categories": "Trailer"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}{endpoint}",
                    headers=self._get_headers(),
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            # Primary trailer is in the 'trailer' field (object, not array)
            trailer = data.get("trailer")
            if trailer and trailer.get("youtube_video_id"):
                return trailer["youtube_video_id"]

            # Fallback: search 'videos' array for a Trailer
            videos = data.get("videos", [])
            for video in videos:
                if "Trailer" in video.get("categories", []) and video.get("youtube_video_id"):
                    return video["youtube_video_id"]

            return None

        except httpx.HTTPStatusError:
            return None
        except Exception:
            return None

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_trailer_by_imdb_id(
        self, imdb_id: str, media_type: str = "movie", language: str = "en"
    ) -> Optional[str]:
        """
        Fetch official trailer YouTube ID by IMDb ID.
        
        Args:
            imdb_id: IMDb ID like 'tt0111161'
            media_type: 'movie' or 'tv'
            language: ISO language code (default: 'en')
            
        Returns:
            YouTube video ID or None
        """
        if not self.api_key:
            return None

        endpoint = "/shows" if media_type == "tv" else "/movies"
        params = {"imdb_id": imdb_id, "language": language, "categories": "Trailer"}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}{endpoint}",
                    headers=self._get_headers(),
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            trailer = data.get("trailer")
            if trailer and trailer.get("youtube_video_id"):
                return trailer["youtube_video_id"]

            videos = data.get("videos", [])
            for video in videos:
                if "Trailer" in video.get("categories", []) and video.get("youtube_video_id"):
                    return video["youtube_video_id"]

            return None

        except httpx.HTTPStatusError:
            return None
        except Exception:
            return None


def youtube_embed_url(video_id: str) -> str:
    """Convert YouTube video ID to embeddable URL."""
    return f"https://www.youtube.com/embed/{video_id}"


# Global service instance
kinocheck_service = KinoCheckService()
