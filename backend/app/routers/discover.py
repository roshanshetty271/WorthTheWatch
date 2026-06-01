"""
Worth the Watch? — Discover / Genre Picker Router
Advanced filtering via TMDB /discover, with the app's WORTH-IT picks surfaced first.

Supports multiple genres (match any/all), year, rating, and sort. Cross-references
our review DB for verdict badges, and on page 1 returns a `worth_it` array — our
vetted picks for the chosen genre(s) — ahead of the broad catalog.

All DB access is best-effort: if the DB is unavailable, the broad TMDB catalog still
serves (just without verdict badges / worth-it picks) instead of 500-ing.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload

from app.database import async_session
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content

logger = logging.getLogger(__name__)

router = APIRouter()

TMDB_IMG = "https://image.tmdb.org/t/p/w500"

WORTH_IT_LIMIT = 24          # max curated picks on page 1
CANDIDATE_LIMIT = 300        # reviewed WORTH-IT movies scanned for genre matches

# ─── Genre ID Mapping ──────────────────────────────────────
MOVIE_GENRES = {
    "action": 28, "adventure": 12, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "fantasy": 14, "history": 36, "horror": 27, "music": 10402,
    "mystery": 9648, "romance": 10749, "science-fiction": 878,
    "sci-fi": 878, "thriller": 53, "war": 10752, "western": 37,
}

# TMDB TV genres are a DIFFERENT set from movies — no standalone Thriller/Horror.
TV_GENRES = {
    "action": 10759, "adventure": 10759, "animation": 16, "comedy": 35,
    "crime": 80, "documentary": 99, "drama": 18, "family": 10751,
    "kids": 10762, "mystery": 9648, "reality": 10764,
    "sci-fi": 10765, "science-fiction": 10765, "fantasy": 10765,
    "war": 10768, "western": 37,
}

# Explicit chip lists (id + display) per media type — what the UI offers.
# Frontend selects by id and sends ids, so display names can be accurate ("&" etc).
MOVIE_GENRE_OPTIONS = [
    {"id": 28, "name": "Action"}, {"id": 12, "name": "Adventure"}, {"id": 16, "name": "Animation"},
    {"id": 35, "name": "Comedy"}, {"id": 80, "name": "Crime"}, {"id": 99, "name": "Documentary"},
    {"id": 18, "name": "Drama"}, {"id": 10751, "name": "Family"}, {"id": 14, "name": "Fantasy"},
    {"id": 36, "name": "History"}, {"id": 27, "name": "Horror"}, {"id": 10402, "name": "Music"},
    {"id": 9648, "name": "Mystery"}, {"id": 10749, "name": "Romance"}, {"id": 878, "name": "Sci-Fi"},
    {"id": 53, "name": "Thriller"}, {"id": 10752, "name": "War"}, {"id": 37, "name": "Western"},
]
TV_GENRE_OPTIONS = [
    {"id": 10759, "name": "Action & Adventure"}, {"id": 16, "name": "Animation"},
    {"id": 35, "name": "Comedy"}, {"id": 80, "name": "Crime"}, {"id": 99, "name": "Documentary"},
    {"id": 18, "name": "Drama"}, {"id": 10751, "name": "Family"}, {"id": 10762, "name": "Kids"},
    {"id": 9648, "name": "Mystery"}, {"id": 10764, "name": "Reality"},
    {"id": 10765, "name": "Sci-Fi & Fantasy"}, {"id": 10768, "name": "War & Politics"},
    {"id": 37, "name": "Western"},
]

SORT_OPTIONS = {
    "popular": "popularity.desc",
    "rating": "vote_average.desc",
    "newest": "primary_release_date.desc",
    "oldest": "primary_release_date.asc",
    "votes": "vote_count.desc",
    "revenue": "revenue.desc",
}


def _format_discover_result(item: dict, media_type: str) -> dict:
    """Format a TMDB discover result for the broad grid."""
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


def _format_pick(m: Movie) -> dict:
    """Format a reviewed WORTH-IT movie (our vetted pick) for the hero row."""
    poster = m.poster_path
    review = m.review
    return {
        "tmdb_id": m.tmdb_id,
        "title": m.title,
        "media_type": m.media_type,
        "release_date": m.release_date.isoformat() if m.release_date else "",
        "poster_path": poster,
        "poster_url": f"{TMDB_IMG}{poster}" if poster else None,
        "overview": (m.overview or "")[:200],
        "tmdb_vote_average": m.tmdb_vote_average,
        "tmdb_vote_count": m.tmdb_vote_count,
        "verdict": review.verdict if review else None,
        "has_review": True,
        "hook": (review.hook or review.vibe) if review else None,
    }


@router.get("")
async def discover(
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    genre: Optional[str] = Query(None, description="Genre name(s), comma-separated e.g. 'thriller,mystery'"),
    match: str = Query("any", pattern="^(any|all)$", description="Combine genres: any (OR) / all (AND)"),
    year: Optional[int] = Query(None, ge=1900, le=2030),
    min_rating: Optional[float] = Query(None, ge=0, le=10),
    max_rating: Optional[float] = Query(None, ge=0, le=10),
    sort: str = Query("popular", description="popular | rating | newest | oldest | votes | revenue"),
    min_votes: int = Query(100, ge=0),
    page: int = Query(1, ge=1, le=20),
):
    """
    Discover movies/TV with advanced filters, WORTH-IT picks surfaced first.

    - `genre`: one or more genre names (comma-separated). Unknown names ignored.
    - `match`: `any` (OR) or `all` (AND) when combining genres.
    """
    # Accept genre IDs (preferred — what the UI sends) OR names (back-compat for old links).
    genre_map = TV_GENRES if media_type == "tv" else MOVIE_GENRES
    genre_tokens = [t.strip() for t in (genre or "").split(",") if t.strip()]
    genre_ids: list[int] = []
    for tok in genre_tokens:
        gid = int(tok) if tok.isdigit() else genre_map.get(tok.lower())
        if gid and gid not in genre_ids:
            genre_ids.append(gid)

    # ─── Broad TMDB catalog (free; the "more to explore" grid) ──────────────
    params = {
        "page": page,
        "language": "en-US",
        "include_adult": "false",
        "vote_count.gte": min_votes,
        "sort_by": SORT_OPTIONS.get(sort, "popularity.desc"),
    }
    if sort == "rating" and min_votes < 1000:
        params["vote_count.gte"] = 1000  # filter manipulated scores
    if genre_ids:
        params["with_genres"] = ("," if match == "all" else "|").join(str(g) for g in genre_ids)
    if year:
        if media_type == "tv":
            params["first_air_date_year"] = year
        else:
            params["primary_release_year"] = year
    if min_rating is not None:
        params["vote_average.gte"] = min_rating
    if max_rating is not None:
        params["vote_average.lte"] = max_rating

    try:
        endpoint = "/discover/tv" if media_type == "tv" else "/discover/movie"
        data = await tmdb_service._get(endpoint, params=params)
        raw_results = data.get("results", [])
        results = [
            _format_discover_result(item, media_type)
            for item in raw_results
            if item.get("poster_path") and is_safe_content(item)
        ]
        total_pages = min(data.get("total_pages", 1), 20)
        total = data.get("total_results", 0)
    except Exception as e:
        logger.error(f"Discover TMDB failed: {e}")
        return {"results": [], "worth_it": [], "total": 0, "page": 1, "total_pages": 1, "filters": {}}

    # ─── Best-effort DB: verdict badges + WORTH-IT picks (skipped if DB down) ─
    worth_it: list[dict] = []
    try:
        async with async_session() as db:
            # Verdict badges for the broad grid
            if results:
                ids = [r["tmdb_id"] for r in results]
                vrows = await db.execute(
                    select(Movie.tmdb_id, Review.verdict)
                    .join(Review, Review.movie_id == Movie.id)
                    .where(Movie.tmdb_id.in_(ids), Movie.media_type == media_type)
                )
                vmap = {row.tmdb_id: row.verdict for row in vrows.all()}
                for r in results:
                    r["verdict"] = vmap.get(r["tmdb_id"])
                    r["has_review"] = r["tmdb_id"] in vmap

            # WORTH-IT picks — page 1 only. Ordered to MATCH the chosen sort so
            # "Highest Rated" surfaces high-scored picks (not popularity).
            if page == 1:
                wq = (
                    select(Movie)
                    .options(joinedload(Movie.review))
                    .join(Review)
                    .where(Review.verdict == "WORTH IT", Movie.media_type == media_type)
                )
                if sort == "rating":
                    wq = wq.order_by(desc(Movie.tmdb_vote_average))
                elif sort == "newest":
                    wq = wq.order_by(desc(Movie.release_date))
                elif sort == "oldest":
                    wq = wq.order_by(Movie.release_date)
                else:
                    wq = wq.order_by(desc(Movie.tmdb_popularity))
                wq = wq.limit(CANDIDATE_LIMIT)
                candidates = (await db.execute(wq)).unique().scalars().all()

                for m in candidates:
                    # genre match (any/all)
                    if genre_ids:
                        movie_gids = {g.get("id") for g in (m.genres or []) if isinstance(g, dict)}
                        if match == "all":
                            if not all(gid in movie_gids for gid in genre_ids):
                                continue
                        elif not any(gid in movie_gids for gid in genre_ids):
                            continue
                    # honor the same year / rating filters as the grid
                    if year and not (m.release_date and m.release_date.year == year):
                        continue
                    if min_rating is not None and not (m.tmdb_vote_average and m.tmdb_vote_average >= min_rating):
                        continue
                    worth_it.append(_format_pick(m))
                    if len(worth_it) >= WORTH_IT_LIMIT:
                        break
    except Exception as e:
        logger.warning(f"Discover DB enrichment skipped (DB unavailable): {e}")

    # Don't show the same title twice (hero + grid)
    if worth_it:
        worth_ids = {w["tmdb_id"] for w in worth_it}
        results = [r for r in results if r["tmdb_id"] not in worth_ids]

    return {
        "results": results,
        "worth_it": worth_it,
        "total": total,
        "page": page,
        "total_pages": total_pages,
        "filters": {
            "media_type": media_type,
            "genres": genre_ids,
            "match": match,
            "year": year,
            "min_rating": min_rating,
            "sort": sort,
        },
    }


@router.get("/genres")
async def get_genres(
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
):
    """Genre options (id + display name) for the filter UI — valid for the media type."""
    return {"genres": TV_GENRE_OPTIONS if media_type == "tv" else MOVIE_GENRE_OPTIONS}
