"""
Worth the Watch? — Discover Router
Advanced filtering using TMDB /discover/movie and /discover/tv.
Filter by genre, year, rating, sort order, and more.
Cross-references with our review database for verdicts.
"""

import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content

logger = logging.getLogger(__name__)

router = APIRouter()

TMDB_IMG = "https://image.tmdb.org/t/p/w500"

# ─── Genre ID Mapping ──────────────────────────────────────
# TMDB genre IDs for movies
MOVIE_GENRES = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "science-fiction": 878,
    "sci-fi": 878, "thriller": 53, "war": 10752, "western": 37,
}

# TMDB genre IDs for TV
TV_GENRES = {
    "action": 10759, "adventure": 10759, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 10765, "sci-fi": 10765, "science-fiction": 10765,
    "mystery": 9648, "romance": 10749, "thriller": 53, "war": 10768,
    "western": 37, "reality": 10764, "soap": 10766,
}

SORT_OPTIONS = {
    "popular": "popularity.desc",
    "rating": "vote_average.desc",
    "newest": "primary_release_date.desc",
    "oldest": "primary_release_date.asc",
    "votes": "vote_count.desc",
    "revenue": "revenue.desc",
}


def _format_discover_result(item: dict, media_type: str) -> dict:
    """Format a TMDB discover result."""
    title = item.get("title") or item.get("name") or ""
    release = item.get("release_date") or item.get("first_air_date") or ""
    poster = item.get("poster_path")

    return {
        "tmdb_id": item.get("id"),
        "title": title,
        "media_type": media_type,
        "release_date": release,
        "poster_path": poster,
        "poster_url": f"{TMDB_IMG}{poster}" if poster else None,
        "overview": item.get("overview", "")[:200],
        "tmdb_vote_average": item.get("vote_average"),
        "tmdb_vote_count": item.get("vote_count"),
        "genre_ids": item.get("genre_ids", []),
    }


@router.get("")
async def discover(
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    genre: Optional[str] = Query(None, description="Genre name like 'action', 'comedy', 'horror'"),
    year: Optional[int] = Query(None, ge=1900, le=2030, description="Release year"),
    min_rating: Optional[float] = Query(None, ge=0, le=10, description="Minimum TMDB rating"),
    max_rating: Optional[float] = Query(None, ge=0, le=10, description="Maximum TMDB rating"),
    sort: str = Query("popular", description="Sort: popular, rating, newest, oldest, votes, revenue"),
    min_votes: int = Query(100, ge=0, description="Minimum vote count (filters out obscure titles)"),
    page: int = Query(1, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    """
    Discover movies or TV shows with advanced filters.
    
    Examples:
    - Best action movies of 2024: ?genre=action&year=2024&sort=rating&min_votes=500
    - Popular horror: ?genre=horror&sort=popular
    - Hidden gems (high rating, low votes): ?min_rating=7.5&sort=rating&min_votes=50&max_votes=500
    - New releases: ?sort=newest&min_votes=50
    """
    # Build TMDB params
    params = {
        "page": page,
        "language": "en-US",
        "include_adult": "false",
        "vote_count.gte": min_votes,
    }

    # Sort
    sort_key = SORT_OPTIONS.get(sort, "popularity.desc")
    params["sort_by"] = sort_key

    # Genre
    if genre:
        genre_lower = genre.lower().strip()
        genre_map = TV_GENRES if media_type == "tv" else MOVIE_GENRES
        genre_id = genre_map.get(genre_lower)
        if genre_id:
            params["with_genres"] = str(genre_id)

    # Year
    if year:
        if media_type == "tv":
            params["first_air_date_year"] = year
        else:
            params["primary_release_year"] = year

    # Rating range
    if min_rating is not None:
        params["vote_average.gte"] = min_rating
    if max_rating is not None:
        params["vote_average.lte"] = max_rating

    # Call TMDB discover
    try:
        endpoint = "/discover/tv" if media_type == "tv" else "/discover/movie"
        data = await tmdb_service._get(endpoint, params=params)

        raw_results = data.get("results", [])
        results = [
            _format_discover_result(item, media_type)
            for item in raw_results
            if item.get("poster_path") and is_safe_content(item)
        ]

        # Cross-reference with our review database
        if results:
            tmdb_ids = [r["tmdb_id"] for r in results]
            reviewed = await db.execute(
                select(Movie.tmdb_id, Review.verdict)
                .join(Review, Review.movie_id == Movie.id)
                .where(Movie.tmdb_id.in_(tmdb_ids))
            )
            verdict_map = {row.tmdb_id: row.verdict for row in reviewed.all()}

            for r in results:
                r["verdict"] = verdict_map.get(r["tmdb_id"])
                r["has_review"] = r["tmdb_id"] in verdict_map

        return {
            "results": results,
            "total": data.get("total_results", 0),
            "page": page,
            "total_pages": min(data.get("total_pages", 1), 20),
            "filters": {
                "media_type": media_type,
                "genre": genre,
                "year": year,
                "min_rating": min_rating,
                "sort": sort,
            },
        }
    except Exception as e:
        logger.error(f"Discover failed: {e}")
        return {"results": [], "total": 0, "page": 1, "total_pages": 1, "filters": {}}


@router.get("/genres")
async def get_genres(
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
):
    """Get available genre list for the filter UI."""
    genre_map = TV_GENRES if media_type == "tv" else MOVIE_GENRES
    # Deduplicate (sci-fi and science-fiction map to same ID)
    seen_ids = set()
    genres = []
    for name, gid in sorted(genre_map.items()):
        if gid not in seen_ids:
            seen_ids.add(gid)
            genres.append({"id": gid, "name": name.replace("-", " ").title()})
    return {"genres": genres}