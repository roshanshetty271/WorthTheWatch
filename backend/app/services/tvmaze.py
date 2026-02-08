"""
Worth the Watch? — TVMaze API Service
Free TV show data: episodes, cast, schedules, ratings.
No API key required for basic endpoints.

API Docs: https://api.tvmaze.com/
"""

import httpx
import logging
from typing import Optional
from app.services.retry import with_retry

logger = logging.getLogger(__name__)


class TVMazeShow:
    """Container for TVMaze show data."""
    
    def __init__(
        self,
        id: int,
        name: str,
        language: Optional[str] = None,
        genres: Optional[list[str]] = None,
        status: Optional[str] = None,  # "Running", "Ended", etc.
        premiered: Optional[str] = None,
        ended: Optional[str] = None,
        official_site: Optional[str] = None,
        runtime: Optional[int] = None,
        average_runtime: Optional[int] = None,
        rating: Optional[float] = None,  # TVMaze rating out of 10
        network: Optional[str] = None,
        web_channel: Optional[str] = None,  # Netflix, Prime, etc.
        summary: Optional[str] = None,
        image_url: Optional[str] = None,
        imdb_id: Optional[str] = None,
        thetvdb_id: Optional[int] = None,
    ):
        self.id = id
        self.name = name
        self.language = language
        self.genres = genres or []
        self.status = status
        self.premiered = premiered
        self.ended = ended
        self.official_site = official_site
        self.runtime = runtime
        self.average_runtime = average_runtime
        self.rating = rating
        self.network = network
        self.web_channel = web_channel
        self.summary = summary
        self.image_url = image_url
        self.imdb_id = imdb_id
        self.thetvdb_id = thetvdb_id

    def to_dict(self) -> dict:
        return {
            "tvmaze_id": self.id,
            "name": self.name,
            "language": self.language,
            "genres": self.genres,
            "status": self.status,
            "premiered": self.premiered,
            "ended": self.ended,
            "runtime": self.runtime or self.average_runtime,
            "rating": self.rating,
            "network": self.network or self.web_channel,
            "summary": self.summary,
            "image_url": self.image_url,
            "imdb_id": self.imdb_id,
        }


class TVMazeEpisode:
    """Container for TVMaze episode data."""
    
    def __init__(
        self,
        id: int,
        name: str,
        season: int,
        number: int,
        airdate: Optional[str] = None,
        runtime: Optional[int] = None,
        rating: Optional[float] = None,
        summary: Optional[str] = None,
        image_url: Optional[str] = None,
    ):
        self.id = id
        self.name = name
        self.season = season
        self.number = number
        self.airdate = airdate
        self.runtime = runtime
        self.rating = rating
        self.summary = summary
        self.image_url = image_url

    def to_dict(self) -> dict:
        return {
            "tvmaze_id": self.id,
            "name": self.name,
            "season": self.season,
            "episode": self.number,
            "airdate": self.airdate,
            "runtime": self.runtime,
            "rating": self.rating,
            "summary": self.summary,
        }


class TVMazeService:
    """TVMaze API client for TV show data.
    
    This is a FREE API - no API key required for basic usage.
    Rate limit: ~20 requests per 10 seconds.
    """
    
    BASE_URL = "https://api.tvmaze.com"

    def _parse_show(self, data: dict) -> TVMazeShow:
        """Parse raw API response into TVMazeShow."""
        rating = data.get("rating", {})
        network = data.get("network", {})
        web_channel = data.get("webChannel", {})
        image = data.get("image", {})
        externals = data.get("externals", {})
        
        return TVMazeShow(
            id=data.get("id", 0),
            name=data.get("name", ""),
            language=data.get("language"),
            genres=data.get("genres", []),
            status=data.get("status"),
            premiered=data.get("premiered"),
            ended=data.get("ended"),
            official_site=data.get("officialSite"),
            runtime=data.get("runtime"),
            average_runtime=data.get("averageRuntime"),
            rating=rating.get("average") if rating else None,
            network=network.get("name") if network else None,
            web_channel=web_channel.get("name") if web_channel else None,
            summary=data.get("summary"),
            image_url=image.get("original") if image else None,
            imdb_id=externals.get("imdb") if externals else None,
            thetvdb_id=externals.get("thetvdb") if externals else None,
        )

    @with_retry(max_retries=2, base_delay=0.5, timeout=10.0)
    async def search_shows(self, query: str) -> list[TVMazeShow]:
        """
        Search for TV shows by name.
        
        Args:
            query: Show name to search
            
        Returns:
            List of TVMazeShow objects sorted by relevance
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search/shows",
                    params={"q": query},
                )
                resp.raise_for_status()
                data = resp.json()

            results = []
            for item in data:
                show_data = item.get("show", {})
                results.append(self._parse_show(show_data))
            
            return results

        except httpx.HTTPStatusError:
            return []
        except Exception as e:
            logger.warning(f"TVMaze search failed: {e}")
            return []

    @with_retry(max_retries=2, base_delay=0.5, timeout=10.0)
    async def get_show_by_id(self, tvmaze_id: int) -> Optional[TVMazeShow]:
        """
        Get show details by TVMaze ID.
        
        Args:
            tvmaze_id: TVMaze show ID
            
        Returns:
            TVMazeShow or None
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.BASE_URL}/shows/{tvmaze_id}")
                resp.raise_for_status()
                data = resp.json()

            return self._parse_show(data)

        except httpx.HTTPStatusError:
            return None
        except Exception as e:
            logger.warning(f"TVMaze get show failed: {e}")
            return None

    @with_retry(max_retries=2, base_delay=0.5, timeout=10.0)
    async def lookup_by_imdb(self, imdb_id: str) -> Optional[TVMazeShow]:
        """
        Look up show by IMDb ID.
        
        Args:
            imdb_id: IMDb ID like 'tt0944947'
            
        Returns:
            TVMazeShow or None
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/lookup/shows",
                    params={"imdb": imdb_id},
                )
                resp.raise_for_status()
                data = resp.json()

            return self._parse_show(data)

        except httpx.HTTPStatusError:
            return None
        except Exception as e:
            logger.warning(f"TVMaze IMDb lookup failed: {e}")
            return None

    @with_retry(max_retries=2, base_delay=0.5, timeout=10.0)
    async def lookup_by_thetvdb(self, thetvdb_id: int) -> Optional[TVMazeShow]:
        """
        Look up show by TheTVDB ID.
        
        Args:
            thetvdb_id: TheTVDB show ID
            
        Returns:
            TVMazeShow or None
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/lookup/shows",
                    params={"thetvdb": thetvdb_id},
                )
                resp.raise_for_status()
                data = resp.json()

            return self._parse_show(data)

        except httpx.HTTPStatusError:
            return None
        except Exception as e:
            logger.warning(f"TVMaze TVDB lookup failed: {e}")
            return None

    @with_retry(max_retries=2, base_delay=0.5, timeout=10.0)
    async def get_episodes(self, tvmaze_id: int) -> list[TVMazeEpisode]:
        """
        Get all episodes for a show.
        
        Args:
            tvmaze_id: TVMaze show ID
            
        Returns:
            List of TVMazeEpisode objects
        """
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"{self.BASE_URL}/shows/{tvmaze_id}/episodes")
                resp.raise_for_status()
                data = resp.json()

            episodes = []
            for item in data:
                image = item.get("image", {})
                rating = item.get("rating", {})
                
                ep = TVMazeEpisode(
                    id=item.get("id", 0),
                    name=item.get("name", ""),
                    season=item.get("season", 0),
                    number=item.get("number", 0),
                    airdate=item.get("airdate"),
                    runtime=item.get("runtime"),
                    rating=rating.get("average") if rating else None,
                    summary=item.get("summary"),
                    image_url=image.get("original") if image else None,
                )
                episodes.append(ep)
            
            return episodes

        except httpx.HTTPStatusError:
            return []
        except Exception as e:
            logger.warning(f"TVMaze get episodes failed: {e}")
            return []

    async def get_show_stats(self, tvmaze_id: int) -> dict:
        """
        Get show statistics: rating, episode count, seasons.
        
        Returns:
            {
                "rating": 8.5,
                "total_episodes": 73,
                "total_seasons": 8,
                "status": "Ended",
                "network": "HBO"
            }
        """
        show = await self.get_show_by_id(tvmaze_id)
        if not show:
            return {}
        
        episodes = await self.get_episodes(tvmaze_id)
        seasons = set(ep.season for ep in episodes if ep.season)
        
        return {
            "rating": show.rating,
            "total_episodes": len(episodes),
            "total_seasons": len(seasons),
            "status": show.status,
            "network": show.network or show.web_channel,
        }


# Global service instance
tvmaze_service = TVMazeService()
