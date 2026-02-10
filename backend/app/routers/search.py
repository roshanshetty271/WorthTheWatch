"""
Worth the Watch? — Search Router
Search for movies and trigger on-demand review generation.
"""

import hashlib
import os
from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db, async_session
from app.models import Movie, Review, SearchEvent
from app.schemas import MovieWithReview, MovieBase, MovieResponse, ReviewResponse, SearchResult
from app.services.tmdb import tmdb_service
from app.services.pipeline import (
    get_or_create_movie,
    generate_review_for_movie,
    job_progress,
)
from app.middleware.rate_limit import check_rate_limit

router = APIRouter(prefix="/search", tags=["Search"])

# Salt for IP hashing (prevents rainbow table attacks)
IP_HASH_SALT = os.getenv("IP_HASH_SALT", "wtw-default-salt-change-in-prod")


@router.get("/quick")
async def quick_search(
    q: str = Query(..., min_length=2, max_length=200),
    db: AsyncSession = Depends(get_db),
):
    """Quick search for dropdown — returns TMDB results with review status."""
    tmdb_results = await tmdb_service.search(q)
    
    suggestion = None
    is_fuzzy = False

    # 1. Exact/Partial Search Results found?
    if not tmdb_results:
        # 2. Try Advanced Fuzzy Search (Prioritize "The Martian" over random substrings)
        fuzzy_match = await tmdb_service.fuzzy_search(q)
        if fuzzy_match:
            tmdb_results = fuzzy_match["results"][:3]
            suggestion = fuzzy_match["suggestion"]
            is_fuzzy = True
        
        # 3. If Fuzzy fails, try Recursive Trimming (for simple suffix typos)
        if not tmdb_results:
            trimmed_q = q
            while len(trimmed_q) > 3 and not tmdb_results:
                trimmed_q = trimmed_q[:-1]
                tmdb_results = await tmdb_service.search(trimmed_q)
                if tmdb_results:
                    # Don't set is_fuzzy=True for simple substring matches if 
                    # we want to avoid the "Did you mean..." being weird.
                    # But the user might want to know why they are seeing "Demetri Martin" for "martia"
                    # Actually, if it's a substring match, the results might just be valid partial matches.
                    # Let's set fuzzy=True but maybe suppress the generic banner if suggestion is None?
                    is_fuzzy = True
                    tmdb_results = tmdb_results[:3]
                    break

    if not tmdb_results:
        return {"results": [], "did_you_mean": False, "suggestion": None}
    
    # Check which ones we already have reviews for
    # Limit: Normal=8, Fuzzy=3
    limit = 3 if is_fuzzy else 8
    tmdb_ids = [r["id"] for r in tmdb_results[:limit]]
    
    result = await db.execute(
        select(Movie.tmdb_id)
        .join(Review, Movie.id == Review.movie_id)
        .where(Movie.tmdb_id.in_(tmdb_ids))
    )
    reviewed_ids = set(row[0] for row in result.all())
    
    results = []
    for item in tmdb_results[:limit]:
        normalized = tmdb_service.normalize_result(item)
        results.append({
            **normalized,
            "has_review": item["id"] in reviewed_ids,
            "poster_url": tmdb_service.get_poster_url(item.get("poster_path")),
        })
    
    return {"results": results, "did_you_mean": is_fuzzy, "suggestion": suggestion}


@router.get("", response_model=SearchResult)
async def search_movies(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    request: Request = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Search for a movie/show. If found in DB with review, returns immediately.
    If not in DB, searches TMDB and triggers background review generation.
    """
    # Log search event (salted hash for privacy)
    raw_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(f"{IP_HASH_SALT}:{raw_ip}".encode()).hexdigest()[:16]
    db.add(SearchEvent(query=q, ip_hash=ip_hash))

    # Check if already in our DB (case-insensitive search)
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.title.ilike(f"%{q}%"))
        .limit(8)
    )
    db_movies = result.unique().scalars().all()

    # Check if we have any reviewed movies in DB
    reviewed = [m for m in db_movies if m.review]
    db_match = None
    if reviewed:
        movie = reviewed[0]
        movie_resp = MovieResponse(
            id=movie.id,
            tmdb_id=movie.tmdb_id,
            title=movie.title,
            media_type=movie.media_type,
            overview=movie.overview,
            poster_path=movie.poster_path,
            backdrop_path=movie.backdrop_path,
            genres=movie.genres,
            release_date=movie.release_date,
            tmdb_popularity=movie.tmdb_popularity,
            tmdb_vote_average=movie.tmdb_vote_average,
            poster_url=tmdb_service.get_poster_url(movie.poster_path),
            backdrop_url=tmdb_service.get_backdrop_url(movie.backdrop_path),
        )
        review_resp = ReviewResponse.model_validate(movie.review)
        db_match = MovieWithReview(movie=movie_resp, review=review_resp)

    # ALWAYS search TMDB for disambiguation options
    tmdb_results = await tmdb_service.search(q)

    # Fuzzy Fallback for full search page too
    if not tmdb_results and len(q) > 3:
        tmdb_results = await tmdb_service.search(q[:-1])

    if not tmdb_results and not db_match:
        return SearchResult(
            found_in_db=False,
            tmdb_results=[],
        )

    # Return both DB match (if any) AND TMDB results for disambiguation
    return SearchResult(
        found_in_db=db_match is not None,
        movie=db_match,  # Include DB match if we have one
        tmdb_results=[
            MovieBase(**tmdb_service.normalize_result(r))
            for r in tmdb_results[:8]  # Show more options for disambiguation
        ],
        generation_status=None,
    )


@router.post("/generate/{tmdb_id}")
async def trigger_generation(
    tmdb_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    request: Request = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger review generation for a specific TMDB ID."""
    # Check if review already exists
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    if movie and movie.review:
        return {"status": "already_exists", "tmdb_id": tmdb_id}

    # Rate limit
    await check_rate_limit(request, is_generation=True)

    # Trigger background generation
    background_tasks.add_task(
        _generate_review_background,
        tmdb_id=tmdb_id,
        media_type=media_type,
    )

    return {"status": "generating", "tmdb_id": tmdb_id}


@router.get("/status/{tmdb_id}")
async def check_generation_status(
    tmdb_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Poll for review generation status."""
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    if not movie:
        # Check if it's currently processing but not yet in DB (unlikely with our flow)
        # or just started
        progress = job_progress.get(tmdb_id)
        if progress:
             return {"status": "generating", "progress": progress}
        return {"status": "not_found"}

    if movie.review:
        movie_resp = MovieResponse(
            id=movie.id,
            tmdb_id=movie.tmdb_id,
            title=movie.title,
            media_type=movie.media_type,
            overview=movie.overview,
            poster_path=movie.poster_path,
            backdrop_path=movie.backdrop_path,
            genres=movie.genres,
            release_date=movie.release_date,
            tmdb_popularity=movie.tmdb_popularity,
            tmdb_vote_average=movie.tmdb_vote_average,
            poster_url=tmdb_service.get_poster_url(movie.poster_path),
            backdrop_url=tmdb_service.get_backdrop_url(movie.backdrop_path),
        )
        review_resp = ReviewResponse.model_validate(movie.review)
        return {
            "status": "completed",
            "movie": MovieWithReview(movie=movie_resp, review=review_resp),
        }

    # Movie exists but no review yet -> likely generating
    progress = job_progress.get(tmdb_id, "Preparing...")
    return {"status": "generating", "progress": progress}


async def _generate_review_background(tmdb_id: int, media_type: str = "movie"):
    """Background task: generate a review for a movie."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        async with async_session() as db:
            try:
                movie = await get_or_create_movie(db, tmdb_id, media_type)
                await generate_review_for_movie(db, movie)
                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error(f"Background generation failed for {tmdb_id}: {e}")
    except Exception as e:
        logger.critical(f"🚨 Background generation task crashed for {tmdb_id}: {e}")
