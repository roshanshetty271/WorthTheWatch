"""
Worth the Watch? — Movies Router
Endpoints for listing and retrieving movies with reviews.
"""

import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Movie, Review
from app.schemas import MovieWithReview, MovieResponse, ReviewResponse, PaginatedMovies
from app.services.tmdb import tmdb_service

router = APIRouter(prefix="/movies", tags=["Movies"])


@router.get("", response_model=PaginatedMovies)
async def list_movies(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    sort: str = Query("latest", pattern="^(latest|popular|verdict)$"),
    verdict: str = Query(None, pattern="^(WORTH IT|NOT WORTH IT|MIXED BAG)$"),
    media_type: str = Query(None, pattern="^(movie|tv)$"),
    db: AsyncSession = Depends(get_db),
):
    """List movies with their reviews. Paginated."""
    query = select(Movie).options(joinedload(Movie.review))

    # Filters
    if media_type:
        query = query.where(Movie.media_type == media_type)
    if verdict:
        query = query.join(Review).where(Review.verdict == verdict)

    # Sorting (avoid double-join if verdict filter already joined Review)
    if sort == "latest":
        query = query.order_by(desc(Movie.release_date))
    elif sort == "popular":
        query = query.order_by(desc(Movie.tmdb_popularity))
    elif sort == "verdict" and not verdict:
        # Only join Review for sorting if not already joined by verdict filter
        query = query.join(Review, isouter=True).order_by(desc(Review.generated_at))
    elif sort == "verdict" and verdict:
        query = query.order_by(desc(Review.generated_at))

    # Count total (respecting filters)
    count_query = select(func.count()).select_from(Movie)
    if media_type:
        count_query = count_query.where(Movie.media_type == media_type)
    if verdict:
        count_query = count_query.join(Review).where(Review.verdict == verdict)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
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
