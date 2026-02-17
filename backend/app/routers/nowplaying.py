"""
Worth the Watch? — Now Playing Router
Shows what's currently in theaters, new on streaming, and coming soon.

Uses TMDB /discover endpoint with date filters instead of the dedicated
now_playing/on_the_air/upcoming endpoints, which are unreliable:
- now_playing returns movies that left theaters months ago
- on_the_air returns Family Guy and other long-running shows
- upcoming returns movies from the 1980s due to regional re-releases

The discover endpoint with release_date filters gives us clean, 
accurate results every time.
"""

import logging
from datetime import date, timedelta
from fastapi import APIRouter, Query
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content

logger = logging.getLogger(__name__)

router = APIRouter()

TMDB_IMG = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280"


def _format_result(item: dict, media_type: str) -> dict:
    """Format a TMDB result into a consistent shape."""
    title = item.get("title") or item.get("name") or ""
    release = item.get("release_date") or item.get("first_air_date") or ""
    poster = item.get("poster_path")
    backdrop = item.get("backdrop_path")

    return {
        "tmdb_id": item.get("id"),
        "title": title,
        "media_type": media_type,
        "release_date": release,
        "poster_path": poster,
        "poster_url": f"{TMDB_IMG}{poster}" if poster else None,
        "backdrop_path": backdrop,
        "backdrop_url": f"{TMDB_BACKDROP}{backdrop}" if backdrop else None,
        "overview": item.get("overview", ""),
        "tmdb_vote_average": item.get("vote_average"),
        "tmdb_vote_count": item.get("vote_count"),
        "genres": item.get("genre_ids", []),
    }


@router.get("/theaters")
async def now_in_theaters(
    region: str = Query("US", description="ISO 3166-1 country code"),
    page: int = Query(1, ge=1, le=5),
):
    """
    Movies currently in theaters.
    Uses discover with release_date filters: last 45 days to today.
    Only shows movies with theatrical releases and decent vote counts.
    """
    try:
        today = date.today()
        forty_five_days_ago = today - timedelta(days=45)

        data = await tmdb_service._get(
            "/discover/movie",
            params={
                "page": page,
                "region": region,
                "language": "en-US",
                "sort_by": "popularity.desc",
                "with_release_type": "2|3",  # 2=theatrical, 3=theatrical (limited)
                "primary_release_date.gte": forty_five_days_ago.isoformat(),
                "primary_release_date.lte": today.isoformat(),
                "vote_count.gte": 10,  # At least some votes
                "include_adult": "false",
            },
        )

        results = data.get("results", [])
        movies = [_format_result(m, "movie") for m in results if m.get("poster_path") and is_safe_content(m)]

        return {
            "section": "In Theaters",
            "results": movies[:20],
            "total": data.get("total_results", 0),
            "page": page,
        }
    except Exception as e:
        logger.error(f"Failed to fetch now playing: {e}")
        return {"section": "In Theaters", "results": [], "total": 0, "page": 1}


@router.get("/streaming")
async def new_on_streaming(
    page: int = Query(1, ge=1, le=5),
):
    """
    New TV shows that started airing recently (last 90 days).
    Filters by first_air_date to avoid showing Family Guy and other
    long-running shows that technically have "new episodes this week."
    """
    try:
        today = date.today()
        ninety_days_ago = today - timedelta(days=90)

        data = await tmdb_service._get(
            "/discover/tv",
            params={
                "page": page,
                "language": "en-US",
                "sort_by": "popularity.desc",
                "first_air_date.gte": ninety_days_ago.isoformat(),
                "first_air_date.lte": today.isoformat(),
                "vote_count.gte": 5,
                "include_adult": "false",
            },
        )

        results = data.get("results", [])
        shows = [_format_result(s, "tv") for s in results if s.get("poster_path") and is_safe_content(s)]

        return {
            "section": "New on Streaming",
            "results": shows[:20],
            "total": data.get("total_results", 0),
            "page": page,
        }
    except Exception as e:
        logger.error(f"Failed to fetch new streaming: {e}")
        return {"section": "New on Streaming", "results": [], "total": 0, "page": 1}


@router.get("/upcoming")
async def upcoming_movies(
    region: str = Query("US", description="ISO 3166-1 country code"),
    page: int = Query(1, ge=1, le=5),
):
    """
    Movies coming soon — release date is in the future.
    Only shows movies with release dates from tomorrow to 90 days out.
    This prevents 1986 movies from showing as "coming soon."
    """
    try:
        today = date.today()
        tomorrow = today + timedelta(days=1)
        ninety_days_out = today + timedelta(days=90)

        data = await tmdb_service._get(
            "/discover/movie",
            params={
                "page": page,
                "region": region,
                "language": "en-US",
                "sort_by": "popularity.desc",  # Most anticipated first
                "primary_release_date.gte": tomorrow.isoformat(),
                "primary_release_date.lte": ninety_days_out.isoformat(),
                "with_release_type": "2|3",  # Theatrical releases only
                "include_adult": "false",
            },
        )

        results = data.get("results", [])
        movies = [_format_result(m, "movie") for m in results if m.get("poster_path") and is_safe_content(m)]

        return {
            "section": "Coming Soon",
            "results": movies[:20],
            "total": data.get("total_results", 0),
            "page": page,
        }
    except Exception as e:
        logger.error(f"Failed to fetch upcoming: {e}")
        return {"section": "Coming Soon", "results": [], "total": 0, "page": 1}