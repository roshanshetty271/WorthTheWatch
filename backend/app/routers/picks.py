"""
Worth the Watch? — Genre Picks Router
A standalone "Genre Picks" feature: pick one or more genres (match any/all) and get
the app's WORTH-IT picks surfaced first, then a broad TMDB catalog to explore.

Reads only — never generates reviews, so it costs $0 in Serper/LLM credits.
Reuses Discover's genre maps + result formatter by IMPORTING them (discover.py is
left untouched). All DB access is best-effort: if Neon is down, the page still
serves TMDB results (just without the WORTH-IT picks / verdict badges).
"""

import logging
from fastapi import APIRouter, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload

from app.database import async_session
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content

# Reuse Discover's mappings/formatter without modifying discover.py
from app.routers.discover import MOVIE_GENRES, TV_GENRES, SORT_OPTIONS, _format_discover_result

logger = logging.getLogger(__name__)

router = APIRouter()

TMDB_IMG = "https://image.tmdb.org/t/p/w500"

WORTH_IT_LIMIT = 24          # max curated picks on page 1
CANDIDATE_LIMIT = 300        # how many reviewed WORTH-IT movies to scan for genre matches


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
        # The one-line hook/vibe is what makes these cards feel "vetted".
        "hook": (review.hook or review.vibe) if review else None,
    }


@router.get("")
async def genre_picks(
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    genres: str = Query("", description="Comma-separated genre names, e.g. 'thriller,mystery'"),
    match: str = Query("any", pattern="^(any|all)$"),
    sort: str = Query("popular", description="popular | rating | newest | oldest | votes | revenue"),
    min_votes: int = Query(200, ge=0),
    page: int = Query(1, ge=1, le=20),
):
    """
    Genre Picks: WORTH-IT picks (from our reviewed catalog) surfaced first, then a
    broad TMDB catalog for the chosen genre(s).

    - `genres`: comma list of genre names (e.g. `thriller,mystery`). Unknown names ignored.
    - `match`: `any` (OR) or `all` (AND) for combining genres.
    """
    genre_map = TV_GENRES if media_type == "tv" else MOVIE_GENRES
    names = [g.strip().lower() for g in genres.split(",") if g.strip()]
    genre_ids: list[int] = []
    for n in names:
        gid = genre_map.get(n)
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
        params["vote_count.gte"] = 1000
    if genre_ids:
        # TMDB: comma = AND, pipe = OR
        joiner = "," if match == "all" else "|"
        params["with_genres"] = joiner.join(str(g) for g in genre_ids)

    try:
        endpoint = "/discover/tv" if media_type == "tv" else "/discover/movie"
        data = await tmdb_service._get(endpoint, params=params)
        raw = data.get("results", [])
        results = [
            _format_discover_result(item, media_type)
            for item in raw
            if item.get("poster_path") and is_safe_content(item)
        ]
        total_pages = min(data.get("total_pages", 1), 20)
    except Exception as e:
        logger.error(f"Genre Picks TMDB fetch failed: {e}")
        return {"worth_it": [], "results": [], "page": 1, "total_pages": 1, "filters": {}}

    # ─── Best-effort DB: WORTH-IT picks + verdict badges (skipped if DB down) ─
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
                    v = vmap.get(r["tmdb_id"])
                    r["verdict"] = v
                    r["has_review"] = v is not None

            # WORTH-IT picks — page 1 only (hero row). If no genres chosen, this
            # becomes the "critically loved right now" default so the page is never empty.
            if page == 1:
                wq = (
                    select(Movie)
                    .options(joinedload(Movie.review))
                    .join(Review)
                    .where(Review.verdict == "WORTH IT", Movie.media_type == media_type)
                    .order_by(desc(Movie.tmdb_popularity))
                    .limit(CANDIDATE_LIMIT)
                )
                candidates = (await db.execute(wq)).unique().scalars().all()
                for m in candidates:
                    if genre_ids:
                        movie_gids = {
                            g.get("id") for g in (m.genres or []) if isinstance(g, dict)
                        }
                        if match == "all":
                            if not all(gid in movie_gids for gid in genre_ids):
                                continue
                        else:
                            if not any(gid in movie_gids for gid in genre_ids):
                                continue
                    worth_it.append(_format_pick(m))
                    if len(worth_it) >= WORTH_IT_LIMIT:
                        break
    except Exception as e:
        logger.warning(f"Genre Picks DB enrichment skipped (DB unavailable): {e}")

    # Don't show the same title twice (hero + grid)
    if worth_it:
        worth_ids = {w["tmdb_id"] for w in worth_it}
        results = [r for r in results if r["tmdb_id"] not in worth_ids]

    return {
        "worth_it": worth_it,
        "results": results,
        "page": page,
        "total_pages": total_pages,
        "filters": {
            "media_type": media_type,
            "genres": names,
            "match": match,
            "sort": sort,
        },
    }
