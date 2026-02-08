"""
Worth the Watch? — Watchmode API Service
Fetches streaming availability (Netflix, Prime, Hulu, etc.) for movies and TV shows.
Free tier: 1000 requests/month.

API Docs: https://api.watchmode.com/docs/
"""

import httpx
import logging
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()
logger = logging.getLogger(__name__)


class StreamingSource:
    """Container for a streaming source."""
    
    def __init__(
        self,
        source_id: int,
        name: str,
        source_type: str,  # "sub" (subscription), "rent", "buy", "free"
        region: str = "US",
        web_url: Optional[str] = None,
        ios_url: Optional[str] = None,
        android_url: Optional[str] = None,
        price: Optional[str] = None,
        format: Optional[str] = None,  # "HD", "4K", etc.
    ):
        self.source_id = source_id
        self.name = name
        self.source_type = source_type
        self.region = region
        self.web_url = web_url
        self.ios_url = ios_url
        self.android_url = android_url
        self.price = price
        self.format = format

    def to_dict(self) -> dict:
        return {
            "source_id": self.source_id,
            "name": self.name,
            "type": self.source_type,
            "region": self.region,
            "web_url": self.web_url,
            "price": self.price,
            "format": self.format,
        }


class WatchmodeService:
    """Watchmode API client for streaming availability.
    
    Supports 200+ streaming services across 50+ countries.
    """
    
    BASE_URL = "https://api.watchmode.com/v1"

    def __init__(self):
        self.api_key = getattr(settings, "WATCHMODE_API_KEY", "")

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_title_id_by_tmdb(
        self, tmdb_id: int, media_type: str = "movie"
    ) -> Optional[int]:
        """
        Look up Watchmode title ID using TMDB ID.
        
        Args:
            tmdb_id: TMDB movie/TV ID
            media_type: 'movie' or 'tv'
            
        Returns:
            Watchmode title_id or None
        """
        if not self.api_key:
            return None

        # Watchmode uses "movie" or "tv_series"
        wm_type = "tv_series" if media_type == "tv" else "movie"
        
        params = {
            "apiKey": self.api_key,
            "source_id": tmdb_id,
            "source": "tmdb",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search/",
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            # Find matching result by type
            for result in data.get("title_results", []):
                if result.get("type") == wm_type:
                    return result.get("id")
            
            # Return first result if no type match
            if data.get("title_results"):
                return data["title_results"][0].get("id")
            
            return None

        except httpx.HTTPStatusError:
            return None
        except Exception as e:
            logger.warning(f"Watchmode lookup failed: {e}")
            return None

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_streaming_sources(
        self,
        title_id: int,
        region: str = "US",
    ) -> list[StreamingSource]:
        """
        Get streaming sources for a title.
        
        Args:
            title_id: Watchmode title ID
            region: ISO country code (default: US)
            
        Returns:
            List of StreamingSource objects
        """
        if not self.api_key:
            return []

        params = {
            "apiKey": self.api_key,
            "regions": region,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/title/{title_id}/sources/",
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            sources = []
            for item in data:
                source = StreamingSource(
                    source_id=item.get("source_id", 0),
                    name=item.get("name", ""),
                    source_type=item.get("type", ""),
                    region=item.get("region", region),
                    web_url=item.get("web_url"),
                    ios_url=item.get("ios_deeplink"),
                    android_url=item.get("android_deeplink"),
                    price=item.get("price"),
                    format=item.get("format"),
                )
                sources.append(source)

            return sources

        except httpx.HTTPStatusError:
            return []
        except Exception as e:
            logger.warning(f"Watchmode sources failed: {e}")
            return []

    async def get_streaming_for_tmdb(
        self,
        tmdb_id: int,
        media_type: str = "movie",
        region: str = "US",
    ) -> list[StreamingSource]:
        """
        Convenience method: Get streaming sources directly from TMDB ID.
        
        Args:
            tmdb_id: TMDB movie/TV ID
            media_type: 'movie' or 'tv'
            region: ISO country code
            
        Returns:
            List of StreamingSource objects
        """
        title_id = await self.get_title_id_by_tmdb(tmdb_id, media_type)
        if not title_id:
            return []
        return await self.get_streaming_sources(title_id, region)

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_all_sources(self, region: str = "US") -> list[dict]:
        """
        Get list of all supported streaming services.
        
        Returns:
            List of source metadata dicts
        """
        if not self.api_key:
            return []

        params = {
            "apiKey": self.api_key,
            "regions": region,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.BASE_URL}/sources/", params=params)
                resp.raise_for_status()
                return resp.json()
        except Exception:
            return []


def format_streaming_summary(sources: list[StreamingSource]) -> dict:
    """
    Format streaming sources into a user-friendly summary.
    
    Returns:
        {
            "subscription": ["Netflix", "Prime Video"],
            "rent": [{"name": "Apple TV", "price": "$3.99"}],
            "buy": [{"name": "Apple TV", "price": "$14.99"}],
            "free": ["Peacock", "Tubi"]
        }
    """
    summary = {
        "subscription": [],
        "rent": [],
        "buy": [],
        "free": [],
    }
    
    seen = set()
    for source in sources:
        key = f"{source.name}_{source.source_type}"
        if key in seen:
            continue
        seen.add(key)
        
        if source.source_type == "sub":
            summary["subscription"].append(source.name)
        elif source.source_type == "rent":
            summary["rent"].append({
                "name": source.name,
                "price": source.price,
            })
        elif source.source_type == "buy":
            summary["buy"].append({
                "name": source.name,
                "price": source.price,
            })
        elif source.source_type == "free":
            summary["free"].append(source.name)
    
    return summary


# Global service instance
watchmode_service = WatchmodeService()
