"""
Worth the Watch? — Movies Router
Endpoints for listing and retrieving movies with reviews.
"""

import math
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Movie, Review
from app.schemas import MovieWithReview, MovieResponse, ReviewResponse, PaginatedMovies
from app.services.tmdb import tmdb_service

router = APIRouter(prefix="/movies", tags=["Movies"])


@router.get("/sections/curated")
async def get_curated_sections(
    db: AsyncSession = Depends(get_db),
):
    """
    Get curated homepage sections.
    
    Returns:
        {
            "this_week": [...],     # Latest releases with verdicts
            "hidden_gems": [...],   # WORTH IT + low popularity
            "skip_these": [...],    # NOT WORTH IT verdicts
        }
    """
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    
    # This Week's Verdicts - Movies released in past 7 days with reviews
    this_week_query = (
        select(Movie)
        .options(joinedload(Movie.review))
        .join(Review)
        .where(Movie.release_date >= week_ago.date())
        .order_by(desc(Movie.release_date))
        .limit(8)
    )
    
    # Hidden Gems - WORTH IT + lower popularity (underrated)
    hidden_gems_query = (
        select(Movie)
        .options(joinedload(Movie.review))
        .join(Review)
        .where(
            and_(
                Review.verdict == "WORTH IT",
                Movie.tmdb_popularity < 50  # Less popular = hidden gem
            )
        )
        .order_by(desc(Review.generated_at))
        .limit(8)
    )
    
    # Skip These - NOT WORTH IT verdicts
    skip_these_query = (
        select(Movie)
        .options(joinedload(Movie.review))
        .join(Review)
        .where(Review.verdict == "NOT WORTH IT")
        .order_by(desc(Review.generated_at))
        .limit(8)
    )
    
    # Execute all queries
    this_week_result = await db.execute(this_week_query)
    hidden_gems_result = await db.execute(hidden_gems_query)
    skip_these_result = await db.execute(skip_these_query)
    
    this_week = this_week_result.unique().scalars().all()
    hidden_gems = hidden_gems_result.unique().scalars().all()
    skip_these = skip_these_result.unique().scalars().all()
    
    return {
        "this_week": [_format_movie_with_review(m) for m in this_week],
        "hidden_gems": [_format_movie_with_review(m) for m in hidden_gems],
        "skip_these": [_format_movie_with_review(m) for m in skip_these],
    }

from typing import Optional

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
    """
    List movies with their reviews. Paginated.
    
    Category param overrides other filters when provided:
    - trending: sort by popularity
    - latest: sort by release date  
    - worth-it: WORTH IT verdicts
    - skip-these: NOT WORTH IT verdicts
    - mixed-bag: MIXED BAG verdicts
    - hidden-gems: WORTH IT + HIGH confidence + low popularity
    - movies: only movies
    - tv-shows: only TV shows
    """
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
            query = query.where(Movie.media_type == "tv").order_by(desc(Movie.release_date))
            count_query = count_query.where(Movie.media_type == "tv")
    
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
async def get_movie(tmdb_id: int, db: AsyncSession = Depends(get_db)):
    """Get a single movie with its review."""
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()

    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    return _format_movie_with_review(movie)


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
