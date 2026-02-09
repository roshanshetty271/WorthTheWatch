"""
Worth the Watch? — Movies Router
Endpoints for listing and retrieving movies with reviews.
"""

import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_, or_

from typing import Optional, List
from sqlalchemy.orm import joinedload, Session
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import Movie, Review
from app.schemas import MovieResponse, ReviewResponse, MovieWithReview, PaginatedMovies
from app.services.tmdb import tmdb_service
from app.services.safety import is_safe_content

router = APIRouter()

@router.get("", response_model=PaginatedMovies)
async def list_movies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    category: Optional[str] = Query(None, pattern="^(trending|latest|worth-it|skip-these|mixed-bag|hidden-gems|movies|tv-shows)$"),
    sort: Optional[str] = Query(None, pattern="^(latest|popular|verdict|release_date)$"),
    verdict: Optional[str] = Query(None, pattern="^(WORTH IT|NOT WORTH IT|MIXED BAG)$"),
    media_type: Optional[str] = Query(None, pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    # ... (function body start)
    query = select(Movie).options(joinedload(Movie.review))
    count_query = select(func.count()).select_from(Movie)
    
    # ─── Category-based queries (Netflix-style sections) ───────────────
    if category:
        if category == "trending":
            query = query.order_by(desc(Movie.tmdb_popularity))
            
        elif category == "latest":
            # Join to only show movies with reviews, sorted by review date
            query = query.join(Review).order_by(desc(Review.generated_at))
            count_query = count_query.join(Review)
            
        elif category == "worth-it":
            query = query.join(Review).where(Review.verdict == "WORTH IT").order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(Review.verdict == "WORTH IT")
            
        elif category == "skip-these":
            query = query.join(Review).where(Review.verdict == "NOT WORTH IT").order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(Review.verdict == "NOT WORTH IT")
            
        elif category == "mixed-bag":
            query = query.join(Review).where(Review.verdict == "MIXED BAG").order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(Review.verdict == "MIXED BAG")
            
        elif category == "hidden-gems":
            # WORTH IT + HIGH confidence + lower popularity
            query = query.join(Review).where(
                and_(
                    Review.verdict == "WORTH IT",
                    Review.confidence == "HIGH",
                    Movie.tmdb_popularity < 50
                )
            ).order_by(desc(Review.generated_at))
            count_query = count_query.join(Review).where(
                and_(
                    Review.verdict == "WORTH IT", 
                    Review.confidence == "HIGH",
                    Movie.tmdb_popularity < 50
                )
            )
            
        elif category == "movies":
            query = query.where(Movie.media_type == "movie").order_by(desc(Movie.release_date))
            count_query = count_query.where(Movie.media_type == "movie")
            
        elif category == "tv-shows":
            # Filter out "NOT WORTH IT" (Skip)
            query = query.join(Review, isouter=True).where(
                and_(
                    Movie.media_type == "tv",
                    or_(Review.verdict != "NOT WORTH IT", Review.verdict.is_(None))
                )
            ).order_by(desc(Movie.release_date))
            count_query = count_query.join(Review, isouter=True).where(
                and_(
                    Movie.media_type == "tv",
                    or_(Review.verdict != "NOT WORTH IT", Review.verdict.is_(None))
                )
            )
    
    else:
        # ─── Legacy behavior (backward compatibility) ──────────────────
        if media_type:
            query = query.where(Movie.media_type == media_type)
            count_query = count_query.where(Movie.media_type == media_type)
        if verdict:
            query = query.join(Review).where(Review.verdict == verdict)
            count_query = count_query.join(Review).where(Review.verdict == verdict)

        # Sorting (default: latest)
        sort = sort or "latest"
        if sort == "latest":
            if not verdict:
                query = query.join(Review, isouter=True)
            query = query.order_by(desc(Review.generated_at).nulls_last(), desc(Movie.release_date))
        elif sort == "release_date":
            query = query.order_by(desc(Movie.release_date))
        elif sort == "popular":
            query = query.order_by(desc(Movie.tmdb_popularity))
        elif sort == "verdict" and not verdict:
            query = query.join(Review, isouter=True).order_by(desc(Review.generated_at))
        elif sort == "verdict" and verdict:
            query = query.order_by(desc(Review.generated_at))

    # ─── Count total ───────────────────────────────────────────────────
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # ─── Paginate ──────────────────────────────────────────────────────
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    movies = result.unique().scalars().all()

    return PaginatedMovies(
        movies=[_format_movie_with_review(m) for m in movies],
        total=total,
        page=page,
        pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/{tmdb_id}", response_model=MovieWithReview)
async def get_movie(
    tmdb_id: int,
    media_type: str = Query(None, pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single movie with its review. Falls back to TMDB if not in our DB."""
    
    # Try our DB first
    query = select(Movie).options(joinedload(Movie.review)).where(Movie.tmdb_id == tmdb_id)
    if media_type:
        query = query.where(Movie.media_type == media_type)
        
    result = await db.execute(query)
    movie = result.unique().scalar_one_or_none()

    if movie:
        return _format_movie_with_review(movie)
    
    # Not in our DB — fetch from TMDB directly
    try:
        tmdb_data = None
        detected_type = media_type or "movie"

        if media_type == "movie":
             tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
        elif media_type == "tv":
             tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
        else:
            # Fallback: Try movie first, then TV
            tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
            if not tmdb_data or not tmdb_data.get("id"):
                tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
                detected_type = "tv"
        
        if tmdb_data and tmdb_data.get("id"):
            # Security Check: Enforce safety filter even for direct ID lookups
            if not is_safe_content(tmdb_data):
                raise HTTPException(status_code=404, detail="Movie not found (blocked)")

            tmdb_data["media_type"] = detected_type
            normalized = tmdb_service.normalize_result(tmdb_data)
            
            # Build movie response from TMDB data
            movie_resp = MovieResponse(
                id=0,  # not in our DB yet
                tmdb_id=normalized.get("tmdb_id", tmdb_id),
                title=normalized.get("title", "Unknown"),
                media_type=normalized.get("media_type", media_type),
                overview=normalized.get("overview"),
                poster_path=normalized.get("poster_path"),
                backdrop_path=normalized.get("backdrop_path"),
                genres=normalized.get("genres", []),
                release_date=normalized.get("release_date"),
                tmdb_popularity=normalized.get("tmdb_popularity"),
                tmdb_vote_average=normalized.get("tmdb_vote_average"),
                poster_url=tmdb_service.get_poster_url(normalized.get("poster_path")),
                backdrop_url=tmdb_service.get_backdrop_url(normalized.get("backdrop_path")),
            )
            return MovieWithReview(movie=movie_resp, review=None)
    except Exception:
        pass
    
    raise HTTPException(status_code=404, detail="Movie not found")


@router.get("/{tmdb_id}/streaming")
async def get_streaming_availability(
    tmdb_id: int,
    region: str = Query("US", max_length=2),
    db: AsyncSession = Depends(get_db),
):
    """
    Get streaming availability for a movie/show.
    Uses TMDB's free watch providers API (JustWatch data).
    
    Returns:
        {
            "available": true,
            "flatrate": [{"name": "Netflix", "logo_url": "..."}],
            "rent": [{"name": "Apple TV", "logo_url": "...", "price": null}],
            "buy": [...],
            "free": [...],
            "justwatch_link": "https://..."
        }
    """
    # Get movie to determine media type
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()
    
    media_type = movie.media_type if movie else "movie"
    
    # Fetch from TMDB (free!)
    providers = await tmdb_service.get_watch_providers(tmdb_id, media_type, region)
    
    # Format response
    def format_provider(p: dict) -> dict:
        logo_path = p.get("logo_path", "")
        return {
            "name": p.get("provider_name", ""),
            "logo_url": f"https://image.tmdb.org/t/p/w92{logo_path}" if logo_path else None,
            "provider_id": p.get("provider_id"),
        }
    
    flatrate = [format_provider(p) for p in providers.get("flatrate", [])]
    rent = [format_provider(p) for p in providers.get("rent", [])]
    buy = [format_provider(p) for p in providers.get("buy", [])]
    free = [format_provider(p) for p in (providers.get("free", []) + providers.get("ads", []))]
    
    has_any = bool(flatrate or rent or buy or free)
    
    return {
        "available": has_any,
        "flatrate": flatrate,
        "rent": rent,
        "buy": buy,
        "free": free,
        "justwatch_link": providers.get("link", ""),
    }


def _format_movie_with_review(movie: Movie) -> MovieWithReview:
    """Format movie + review for API response."""
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

    review_resp = None
    if movie.review:
        review_resp = ReviewResponse.model_validate(movie.review)

    return MovieWithReview(movie=movie_resp, review=review_resp)
