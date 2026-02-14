"""
Worth the Watch? — OMDB API Service
Fetches IMDb, Rotten Tomatoes, and Metascore ratings.
Free tier: 1000 requests/day.
"""

import httpx
import logging
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()
logger = logging.getLogger(__name__)


class OMDBScores:
    """Container for OMDB rating data."""
    
    def __init__(
        self,
        imdb_score: Optional[float] = None,
        imdb_votes: Optional[int] = None,
        rt_critic_score: Optional[int] = None,
        metascore: Optional[int] = None,
    ):
        self.imdb_score = imdb_score
        self.imdb_votes = imdb_votes
        self.rt_critic_score = rt_critic_score
        self.metascore = metascore

    def to_dict(self) -> dict:
        return {
            "imdb_score": self.imdb_score,
            "imdb_votes": self.imdb_votes,
            "rt_critic_score": self.rt_critic_score,
            "metascore": self.metascore,
        }


class OMDBService:
    """OMDB API client for fetching movie/TV ratings."""
    
    BASE_URL = "https://www.omdbapi.com/"

    def __init__(self):
        self.api_key = getattr(settings, "OMDB_API_KEY", "")

    def _parse_imdb_rating(self, value: str) -> Optional[float]:
        """Parse IMDb rating like '8.5' to float."""
        try:
            return float(value) if value and value != "N/A" else None
        except (ValueError, TypeError):
            return None

    def _parse_imdb_votes(self, value: str) -> Optional[int]:
        """Parse IMDb votes like '1,234,567' to int."""
        try:
            return int(value.replace(",", "")) if value and value != "N/A" else None
        except (ValueError, TypeError):
            return None

    def _parse_rt_score(self, ratings: list) -> Optional[int]:
        """Extract Rotten Tomatoes score from Ratings array."""
        for rating in ratings:
            if rating.get("Source") == "Rotten Tomatoes":
                value = rating.get("Value", "")
                try:
                    return int(value.replace("%", ""))
                except (ValueError, TypeError):
                    return None
        return None

    def _parse_metascore(self, value: str) -> Optional[int]:
        """Parse Metascore like '85' to int."""
        try:
            return int(value) if value and value != "N/A" else None
        except (ValueError, TypeError):
            return None

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_scores_by_imdb_id(self, imdb_id: str) -> OMDBScores:
        """
        Fetch ratings from OMDB by IMDb ID.
        
        Args:
            imdb_id: IMDb ID like 'tt0111161'
            
        Returns:
            OMDBScores with available ratings (may have None values)
        """
        if not self.api_key:
            return OMDBScores()

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    self.BASE_URL,
                    params={"apikey": self.api_key, "i": imdb_id},
                )
                
                # Handle API limit errors
                if resp.status_code == 401:
                    logger.warning("⚠️ OMDB API key invalid or limit reached!")
                    return OMDBScores()
                if resp.status_code == 429:
                    logger.warning("⚠️ OMDB daily limit (1000/day) reached!")
                    return OMDBScores()
                if resp.status_code != 200:
                    logger.debug(f"OMDB returned {resp.status_code}")
                    return OMDBScores()
                    
                data = resp.json()

            if data.get("Response") == "False":
                return OMDBScores()

            return OMDBScores(
                imdb_score=self._parse_imdb_rating(data.get("imdbRating", "")),
                imdb_votes=self._parse_imdb_votes(data.get("imdbVotes", "")),
                rt_critic_score=self._parse_rt_score(data.get("Ratings", [])),
                metascore=self._parse_metascore(data.get("Metascore", "")),
            )
        except httpx.TimeoutException:
            logger.debug("OMDB request timed out")
            return OMDBScores()
        except Exception as e:
            logger.error(f"OMDB request failed: {e}")
            return OMDBScores()

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_scores_by_title(
        self, title: str, year: Optional[str] = None, media_type: str = "movie"
    ) -> OMDBScores:
        """
        Fetch ratings from OMDB by title search.
        
        Args:
            title: Movie or TV show title
            year: Optional release year for better matching
            media_type: 'movie' or 'series'
            
        Returns:
            OMDBScores with available ratings
            
        Note:
            OMDB does NOT return Rotten Tomatoes scores for TV shows.
        """
        if not self.api_key:
            return OMDBScores()

        params = {
            "apikey": self.api_key,
            "t": title,
            "type": "series" if media_type in ("tv", "series") else "movie",
        }
        if year:
            params["y"] = year

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.BASE_URL, params=params)
                
                # Handle API limit errors
                if resp.status_code == 401:
                    logger.warning("⚠️ OMDB API key invalid or limit reached!")
                    return OMDBScores()
                if resp.status_code == 429:
                    logger.warning("⚠️ OMDB daily limit (1000/day) reached!")
                    return OMDBScores()
                if resp.status_code != 200:
                    logger.debug(f"OMDB returned {resp.status_code}")
                    return OMDBScores()
                    
                data = resp.json()

            if data.get("Response") == "False":
                return OMDBScores()

            return OMDBScores(
                imdb_score=self._parse_imdb_rating(data.get("imdbRating", "")),
                imdb_votes=self._parse_imdb_votes(data.get("imdbVotes", "")),
                rt_critic_score=self._parse_rt_score(data.get("Ratings", [])),
                metascore=self._parse_metascore(data.get("Metascore", "")),
            )
        except httpx.TimeoutException:
            logger.debug("OMDB request timed out")
            return OMDBScores()
        except Exception as e:
            logger.error(f"OMDB request failed: {e}")
            return OMDBScores()


# Global service instance
omdb_service = OMDBService()
