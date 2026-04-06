"""
Worth the Watch? — MDBList API Service
Fetches RT audience, Letterboxd, Trakt, Common Sense, and related score data.
Free tier: 1000 requests/day.
"""

import httpx
import logging
from typing import Optional

from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()
logger = logging.getLogger(__name__)


class MDBListScores:
    """Container for MDBList score and content metadata."""

    def __init__(
        self,
        imdb_score: Optional[float] = None,
        imdb_votes: Optional[int] = None,
        rt_critic_score: Optional[int] = None,
        rt_critic_votes: Optional[int] = None,
        rt_audience_score: Optional[int] = None,
        rt_audience_votes: Optional[int] = None,
        metascore: Optional[int] = None,
        metascore_votes: Optional[int] = None,
        metacritic_user_score: Optional[float] = None,
        metacritic_user_votes: Optional[int] = None,
        letterboxd_score: Optional[float] = None,
        letterboxd_votes: Optional[int] = None,
        trakt_score: Optional[int] = None,
        trakt_votes: Optional[int] = None,
        rogerebert_score: Optional[float] = None,
        mdblist_score: Optional[int] = None,
        age_rating: Optional[int] = None,
        content_violence: Optional[int] = None,
        content_nudity: Optional[int] = None,
        content_language: Optional[int] = None,
        content_drinking: Optional[int] = None,
        budget: Optional[int] = None,
        revenue: Optional[int] = None,
    ):
        self.imdb_score = imdb_score
        self.imdb_votes = imdb_votes
        self.rt_critic_score = rt_critic_score
        self.rt_critic_votes = rt_critic_votes
        self.rt_audience_score = rt_audience_score
        self.rt_audience_votes = rt_audience_votes
        self.metascore = metascore
        self.metascore_votes = metascore_votes
        self.metacritic_user_score = metacritic_user_score
        self.metacritic_user_votes = metacritic_user_votes
        self.letterboxd_score = letterboxd_score
        self.letterboxd_votes = letterboxd_votes
        self.trakt_score = trakt_score
        self.trakt_votes = trakt_votes
        self.rogerebert_score = rogerebert_score
        self.mdblist_score = mdblist_score
        self.age_rating = age_rating
        self.content_violence = content_violence
        self.content_nudity = content_nudity
        self.content_language = content_language
        self.content_drinking = content_drinking
        self.budget = budget
        self.revenue = revenue


class MDBListService:
    """MDBList API client for fetching supplemental rating data."""

    BASE_URL = "https://api.mdblist.com"

    def __init__(self):
        self.api_key = getattr(settings, "MDBLIST_API_KEY", "")

    def _parse_int(self, value) -> Optional[int]:
        try:
            if value is None or value == "":
                return None
            return int(float(value))
        except (ValueError, TypeError):
            return None

    def _parse_float(self, value) -> Optional[float]:
        try:
            if value is None or value == "":
                return None
            return float(value)
        except (ValueError, TypeError):
            return None

    def _find_rating(self, ratings: list[dict], source: str) -> Optional[dict]:
        source = source.lower()
        for rating in ratings:
            if str(rating.get("source", "")).lower() == source:
                return rating
        return None

    def _build_scores(self, data: dict) -> MDBListScores:
        ratings = data.get("ratings") or []
        commonsense = data.get("commonsense_media") or {}

        imdb = self._find_rating(ratings, "imdb") or {}
        tomatoes = self._find_rating(ratings, "tomatoes") or {}
        popcorn = self._find_rating(ratings, "popcorn") or {}
        metacritic = self._find_rating(ratings, "metacritic") or {}
        metacritic_user = self._find_rating(ratings, "metacriticuser") or {}
        letterboxd = self._find_rating(ratings, "letterboxd") or {}
        trakt = self._find_rating(ratings, "trakt") or {}
        rogerebert = self._find_rating(ratings, "rogerebert") or {}

        return MDBListScores(
            imdb_score=self._parse_float(imdb.get("value")),
            imdb_votes=self._parse_int(imdb.get("votes")),
            rt_critic_score=self._parse_int(tomatoes.get("value")),
            rt_critic_votes=self._parse_int(tomatoes.get("votes")),
            rt_audience_score=self._parse_int(popcorn.get("value")),
            rt_audience_votes=self._parse_int(popcorn.get("votes")),
            metascore=self._parse_int(metacritic.get("value")),
            metascore_votes=self._parse_int(metacritic.get("votes")),
            metacritic_user_score=self._parse_float(metacritic_user.get("value")),
            metacritic_user_votes=self._parse_int(metacritic_user.get("votes")),
            letterboxd_score=self._parse_float(letterboxd.get("value")),
            letterboxd_votes=self._parse_int(letterboxd.get("votes")),
            trakt_score=self._parse_int(trakt.get("value")),
            trakt_votes=self._parse_int(trakt.get("votes")),
            rogerebert_score=self._parse_float(rogerebert.get("value")),
            mdblist_score=self._parse_int(data.get("score_average")),
            age_rating=self._parse_int(commonsense.get("common_sense")),
            content_violence=self._parse_int(commonsense.get("parental_violence")),
            content_nudity=self._parse_int(commonsense.get("parental_nudity")),
            content_language=self._parse_int(commonsense.get("parental_language")),
            content_drinking=self._parse_int(commonsense.get("parental_drinking")),
            budget=self._parse_int(data.get("budget")),
            revenue=self._parse_int(data.get("revenue")),
        )

    @with_retry(max_retries=2, base_delay=0.75, timeout=6.0)
    async def get_scores(self, tmdb_id: int, media_type: str = "movie") -> MDBListScores:
        """Fetch ratings from MDBList by TMDB ID."""
        if not self.api_key:
            return MDBListScores()

        endpoint_type = "show" if media_type in ("tv", "show", "series") else "movie"
        url = f"{self.BASE_URL}/tmdb/{endpoint_type}/{tmdb_id}"

        try:
            async with httpx.AsyncClient(timeout=6) as client:
                resp = await client.get(url, params={"apikey": self.api_key})

                if resp.status_code == 401:
                    logger.warning("⚠️ MDBList API key invalid")
                    return MDBListScores()
                if resp.status_code == 429:
                    logger.warning("⚠️ MDBList daily limit (1000/day) reached!")
                    return MDBListScores()
                if resp.status_code != 200:
                    logger.debug(f"MDBList returned {resp.status_code} for tmdb_id={tmdb_id}")
                    return MDBListScores()

                data = resp.json()

            return self._build_scores(data)
        except httpx.TimeoutException:
            logger.debug("MDBList request timed out")
            return MDBListScores()
        except Exception as e:
            logger.warning(f"MDBList request failed for tmdb_id={tmdb_id}: {e}")
            return MDBListScores()


mdblist_service = MDBListService()
