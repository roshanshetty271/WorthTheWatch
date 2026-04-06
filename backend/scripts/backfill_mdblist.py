import asyncio
import os
import sys
from datetime import datetime

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import async_session
from app.models import Movie, Review
from app.services.mdblist import mdblist_service
from app.services.pipeline import _apply_review_enrichment, _resolve_rating_context


async def backfill_mdblist(delay_seconds: float = 0.2):
    """Backfill MDBList-backed review fields for existing reviews."""
    settings = get_settings()
    if not settings.MDBLIST_API_KEY:
        print("MDBLIST_API_KEY is missing. Aborting.")
        return

    async with async_session() as session:
        stmt = (
            select(Review)
            .join(Movie, Review.movie_id == Movie.id)
            .options(selectinload(Review.movie))
            .where(
                or_(
                    Review.rt_audience_score.is_(None),
                    Review.letterboxd_score.is_(None),
                    Review.trakt_score.is_(None),
                    Review.mdblist_score.is_(None),
                    Review.rogerebert_score.is_(None),
                    Review.age_rating.is_(None),
                    Review.content_violence.is_(None),
                    Review.content_nudity.is_(None),
                    Review.content_language.is_(None),
                    Review.content_drinking.is_(None),
                    Review.budget.is_(None),
                    Review.revenue.is_(None),
                )
            )
            .order_by(Review.id)
        )
        reviews = list((await session.execute(stmt)).scalars().all())

        total = len(reviews)
        print(f"Found {total} reviews to backfill.")

        updated = 0
        skipped = 0
        failed = 0

        for index, review in enumerate(reviews, start=1):
            movie = review.movie
            if not movie or not movie.tmdb_id:
                skipped += 1
                continue

            try:
                media_type = movie.media_type or "movie"
                scores = await mdblist_service.get_scores(movie.tmdb_id, media_type)
                rating_context = _resolve_rating_context(movie, None, scores)
                _apply_review_enrichment(review, rating_context, None, scores)
                review.last_refreshed_at = datetime.utcnow()
                await session.commit()
                updated += 1

                print(
                    f"[{index}/{total}] Updated {movie.title} "
                    f"(tmdb_id={movie.tmdb_id}, audience={review.rt_audience_score}, "
                    f"letterboxd={review.letterboxd_score}, trakt={review.trakt_score})"
                )
            except Exception as exc:
                failed += 1
                await session.rollback()
                print(f"[{index}/{total}] Failed {movie.title} (tmdb_id={movie.tmdb_id}): {exc}")

            if delay_seconds > 0:
                await asyncio.sleep(delay_seconds)

        print(
            "Backfill complete. "
            f"Updated: {updated}, Skipped: {skipped}, Failed: {failed}."
        )


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(backfill_mdblist())
