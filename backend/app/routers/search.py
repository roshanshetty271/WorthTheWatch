"""
Worth the Watch? — Search Router
Search for movies and trigger on-demand review generation.
Includes SSE streaming for real-time progress updates.
"""

import hashlib
import os
import json
import asyncio
import logging

from fastapi import APIRouter, Depends, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select, delete
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

logger = logging.getLogger(__name__)

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
        # 2. Try Advanced Fuzzy Search
        fuzzy_match = await tmdb_service.fuzzy_search(q)
        if fuzzy_match:
            tmdb_results = fuzzy_match["results"][:3]
            suggestion = fuzzy_match["suggestion"]
            is_fuzzy = True
        
        # 3. If Fuzzy fails, try Recursive Trimming
        if not tmdb_results:
            trimmed_q = q
            while len(trimmed_q) > 3 and not tmdb_results:
                trimmed_q = trimmed_q[:-1]
                tmdb_results = await tmdb_service.search(trimmed_q)
                if tmdb_results:
                    is_fuzzy = True
                    tmdb_results = tmdb_results[:3]
                    break

    if not tmdb_results:
        return {"results": [], "did_you_mean": False, "suggestion": None}
    
    limit = 3 if is_fuzzy else 8
    tmdb_ids = [r["id"] for r in tmdb_results[:limit]]
    
    result = await db.execute(
        select(Movie)
        .where(Movie.tmdb_id.in_(tmdb_ids))
    )
    db_movies = {m.tmdb_id: m for m in result.scalars().all()}
    
    results = []
    for item in tmdb_results[:limit]:
        normalized = tmdb_service.normalize_result(item)
        tmdb_id = item["id"]
        db_movie = db_movies.get(tmdb_id)
        has_review = False
        poster_url = normalized.get("poster_url")
        if db_movie:
            pass

    # Improved query with eager loading
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id.in_(tmdb_ids))
    )
    db_movies_map = {m.tmdb_id: m for m in result.unique().scalars().all()}

    results = []
    for item in tmdb_results[:limit]:
        normalized = tmdb_service.normalize_result(item)
        tmdb_id = item["id"]
        
        final_poster_url = normalized.get("poster_url")
        has_review = False
        
        if tmdb_id in db_movies_map:
            db_m = db_movies_map[tmdb_id]
            if db_m.review:
                has_review = True
            if db_m.poster_path:
                final_poster_url = tmdb_service.get_poster_url(db_m.poster_path)

        results.append({
            **normalized,
            "has_review": has_review,
            "poster_url": final_poster_url,
        })
    
    return {"results": results, "did_you_mean": is_fuzzy, "suggestion": suggestion}


@router.get("", response_model=SearchResult)
async def search_movies(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    request: Request = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Search for a movie/show."""
    raw_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(f"{IP_HASH_SALT}:{raw_ip}".encode()).hexdigest()[:16]
    db.add(SearchEvent(query=q, ip_hash=ip_hash))

    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.title.ilike(f"%{q}%"))
        .limit(8)
    )
    db_movies = result.unique().scalars().all()

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

    tmdb_results = await tmdb_service.search(q)

    if not tmdb_results and len(q) > 3:
        tmdb_results = await tmdb_service.search(q[:-1])

    if not tmdb_results and not db_match:
        return SearchResult(
            found_in_db=False,
            tmdb_results=[],
        )

    return SearchResult(
        found_in_db=db_match is not None,
        movie=db_match,
        tmdb_results=[
            MovieBase(**tmdb_service.normalize_result(r))
            for r in tmdb_results[:8]
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
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    if movie and movie.review:
        return {"status": "already_exists", "tmdb_id": tmdb_id}

    # Block unreleased movies
    from datetime import date
    try:
        if media_type == "tv":
            tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
            raw_date = tmdb_data.get("first_air_date") if tmdb_data else None
        else:
            tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
            raw_date = tmdb_data.get("release_date") if tmdb_data else None

        if raw_date and isinstance(raw_date, str) and raw_date.strip():
            release_date = date.fromisoformat(raw_date)
            if release_date > date.today():
                return {
                    "status": "unreleased",
                    "tmdb_id": tmdb_id,
                    "release_date": raw_date,
                    "message": f"This title hasn't been released yet. Check back after {raw_date}.",
                }
    except (ValueError, TypeError):
        pass

    await check_rate_limit(request, is_generation=True)

    background_tasks.add_task(
        _generate_review_background,
        tmdb_id=tmdb_id,
        media_type=media_type,
    )

    return {"status": "generating", "tmdb_id": tmdb_id}


# ─── REGENERATE ENDPOINT ────────────────────────────────────
@router.post("/regenerate/{tmdb_id}")
async def regenerate_review(
    tmdb_id: int,
    media_type: str = Query("movie", pattern="^(movie|tv)$"),
    request: Request = None,
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Delete existing review and regenerate with fresh data."""
    # Rate limit (counts as a generation)
    await check_rate_limit(request, is_generation=True)

    # Find the movie
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    # Delete existing review if it exists
    if movie and movie.review:
        await db.execute(
            delete(Review).where(Review.movie_id == movie.id)
        )
        await db.commit()
        logger.info(f"🗑️ Deleted old review for {movie.title} (tmdb_id={tmdb_id})")

    # Trigger fresh generation
    background_tasks.add_task(
        _generate_review_background,
        tmdb_id=tmdb_id,
        media_type=media_type,
    )

    return {"status": "regenerating", "tmdb_id": tmdb_id}


# ─── SSE STREAM ENDPOINT ────────────────────────────────────
@router.get("/stream/{tmdb_id}")
async def stream_generation_status(
    tmdb_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-Sent Events stream for real-time generation progress.
    Frontend connects via EventSource. Falls back to polling if SSE fails.
    """
    async def event_generator():
        last_progress = ""
        max_wait = 120  # 2 minute timeout
        elapsed = 0
        logger.info(f"📡 SSE stream opened for tmdb_id={tmdb_id}")

        while elapsed < max_wait:
            # Check if review is completed
            async with async_session() as check_db:
                result = await check_db.execute(
                    select(Movie)
                    .options(joinedload(Movie.review))
                    .where(Movie.tmdb_id == tmdb_id)
                )
                movie = result.unique().scalar_one_or_none()

                if movie and movie.review:
                    review_resp = ReviewResponse.model_validate(movie.review)
                    logger.info(f"📡 SSE: Sending completed event for tmdb_id={tmdb_id}")
                    yield f"data: {json.dumps({'type': 'completed', 'review': review_resp.model_dump(mode='json')})}\n\n"
                    return

            # Check progress
            progress_data = job_progress.get(tmdb_id)
            if progress_data:
                if isinstance(progress_data, dict):
                    msg = progress_data.get("message", "Processing...")
                    pct = progress_data.get("percent", 0)
                else:
                    msg = str(progress_data)
                    pct = 0

                # Only send if progress changed
                if msg != last_progress:
                    last_progress = msg
                    logger.info(f"📡 SSE: {msg} ({pct}%) for tmdb_id={tmdb_id}")
                    yield f"data: {json.dumps({'type': 'progress', 'message': msg, 'percent': pct})}\n\n"

            await asyncio.sleep(1)
            elapsed += 1

        # Timeout
        logger.warning(f"📡 SSE: Timeout for tmdb_id={tmdb_id}")
        yield f"data: {json.dumps({'type': 'error', 'message': 'Generation timed out. Please try again.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/status/{tmdb_id}")
async def check_generation_status(
    tmdb_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Poll for review generation status (fallback for SSE)."""
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    if not movie:
        progress_data = job_progress.get(tmdb_id)
        if progress_data:
             if isinstance(progress_data, dict):
                 return {"status": "generating", "progress": progress_data.get("message", "Processing..."), "percent": progress_data.get("percent", 0)}
             return {"status": "generating", "progress": str(progress_data), "percent": 0}
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

    progress_data = job_progress.get(tmdb_id, {"message": "Preparing...", "percent": 0})
    if isinstance(progress_data, dict):
        return {"status": "generating", "progress": progress_data.get("message", "Processing..."), "percent": progress_data.get("percent", 0)}
    return {"status": "generating", "progress": str(progress_data), "percent": 0}


async def _generate_review_background(tmdb_id: int, media_type: str = "movie"):
    """Background task: generate a review for a movie."""
    try:
        async with async_session() as db:
            try:
                movie = await get_or_create_movie(db, tmdb_id, media_type)
                await generate_review_for_movie(db, movie)
                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error(f"Background generation failed for {tmdb_id}: {e}")
                # Store error in job_progress so SSE/polling can report it
                job_progress[tmdb_id] = {"message": f"Failed: {str(e)[:100]}", "percent": 0}
    except Exception as e:
        logger.critical(f"🚨 Background generation task crashed for {tmdb_id}: {e}")
        job_progress[tmdb_id] = {"message": "Generation crashed. Please try again.", "percent": 0}