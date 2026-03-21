"""
Worth the Watch? — Feedback Router
Anonymous thumbs up/down on review verdicts.
IP-deduplicated, one vote per IP per review.
"""

import hashlib
import os
import logging

from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Movie, Review, ReviewFeedback

logger = logging.getLogger(__name__)
router = APIRouter()

IP_HASH_SALT = os.getenv("IP_HASH_SALT", "wtw-default-salt-change-in-prod")


def _hash_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        raw_ip = forwarded.split(",")[0].strip()
    else:
        raw_ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(f"{IP_HASH_SALT}:{raw_ip}".encode()).hexdigest()[:16]


class FeedbackRequest(BaseModel):
    helpful: bool


class FeedbackResponse(BaseModel):
    helpful_count: int
    not_helpful_count: int
    total: int
    user_vote: bool | None = None


@router.post("/{tmdb_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    tmdb_id: int,
    body: FeedbackRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Submit or update feedback on a review verdict."""
    ip_hash = _hash_ip(request)

    result = await db.execute(
        select(Review.id)
        .join(Movie, Movie.id == Review.movie_id)
        .where(Movie.tmdb_id == tmdb_id)
    )
    review_row = result.scalar_one_or_none()
    if not review_row:
        raise HTTPException(status_code=404, detail="Review not found")

    review_id = review_row

    existing = await db.execute(
        select(ReviewFeedback).where(
            ReviewFeedback.review_id == review_id,
            ReviewFeedback.ip_hash == ip_hash,
        )
    )
    feedback = existing.scalar_one_or_none()

    if feedback:
        feedback.is_helpful = body.helpful
    else:
        feedback = ReviewFeedback(
            review_id=review_id,
            is_helpful=body.helpful,
            ip_hash=ip_hash,
        )
        db.add(feedback)

    await db.commit()

    return await _get_aggregate(db, review_id, ip_hash)


@router.get("/{tmdb_id}/feedback", response_model=FeedbackResponse)
async def get_feedback(
    tmdb_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate feedback for a review."""
    ip_hash = _hash_ip(request)

    result = await db.execute(
        select(Review.id)
        .join(Movie, Movie.id == Review.movie_id)
        .where(Movie.tmdb_id == tmdb_id)
    )
    review_row = result.scalar_one_or_none()
    if not review_row:
        raise HTTPException(status_code=404, detail="Review not found")

    return await _get_aggregate(db, review_row, ip_hash)


async def _get_aggregate(db: AsyncSession, review_id: int, ip_hash: str) -> FeedbackResponse:
    """Build aggregate feedback response."""
    counts = await db.execute(
        select(
            func.count().filter(ReviewFeedback.is_helpful.is_(True)).label("helpful"),
            func.count().filter(ReviewFeedback.is_helpful.is_(False)).label("not_helpful"),
        ).where(ReviewFeedback.review_id == review_id)
    )
    row = counts.one()
    helpful_count = row.helpful or 0
    not_helpful_count = row.not_helpful or 0

    user_result = await db.execute(
        select(ReviewFeedback.is_helpful).where(
            ReviewFeedback.review_id == review_id,
            ReviewFeedback.ip_hash == ip_hash,
        )
    )
    user_row = user_result.scalar_one_or_none()

    return FeedbackResponse(
        helpful_count=helpful_count,
        not_helpful_count=not_helpful_count,
        total=helpful_count + not_helpful_count,
        user_vote=user_row,
    )
