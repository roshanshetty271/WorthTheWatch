"""
Batch-generate reviews for all curated mood movies that are missing from the DB.
Collects all unique TMDB IDs across moods, checks which ones lack reviews,
and generates them one at a time with a delay to be kind to external APIs.

Usage:
    cd backend
    python -m scripts.batch_generate_mood_reviews
"""

import asyncio
import logging
import sys

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.database import async_session
from app.models import Movie, Review
from app.services.curated_moods import CURATED_MOODS
from app.services.pipeline import get_or_create_movie, generate_review_for_movie

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

DELAY_BETWEEN_REVIEWS = 3  # seconds between each generation


async def main():
    all_ids: set[int] = set()
    for mood, ids in CURATED_MOODS.items():
        all_ids.update(ids)
        logger.info(f"  {mood}: {len(ids)} curated IDs")
    logger.info(f"Total unique TMDB IDs across all moods: {len(all_ids)}")

    async with async_session() as session:
        result = await session.execute(
            select(Movie.tmdb_id)
            .join(Review, Review.movie_id == Movie.id)
            .where(Movie.tmdb_id.in_(list(all_ids)))
        )
        existing = {row.tmdb_id for row in result.all()}

    missing = all_ids - existing
    logger.info(f"Already have reviews: {len(existing)}")
    logger.info(f"Need to generate: {len(missing)}")

    if not missing:
        logger.info("Nothing to generate — all curated movies have reviews.")
        return

    sorted_missing = sorted(missing)
    generated = 0
    failed = 0

    for i, tmdb_id in enumerate(sorted_missing, 1):
        logger.info(f"[{i}/{len(sorted_missing)}] Generating review for TMDB ID {tmdb_id}...")
        try:
            async with async_session() as session:
                movie = await get_or_create_movie(session, tmdb_id, "movie")
                if not movie:
                    logger.warning(f"  Could not find/create movie for TMDB ID {tmdb_id}, skipping")
                    failed += 1
                    continue

                existing_review = await session.execute(
                    select(Review).where(Review.movie_id == movie.id)
                )
                if existing_review.scalar_one_or_none():
                    logger.info(f"  Review already exists for '{movie.title}', skipping")
                    continue

                review = await generate_review_for_movie(session, movie)
                if review:
                    await session.commit()
                    generated += 1
                    logger.info(f"  Done: '{movie.title}' -> {review.verdict}")
                else:
                    logger.warning(f"  Pipeline returned None for '{movie.title}'")
                    failed += 1
        except Exception as e:
            logger.error(f"  Failed TMDB ID {tmdb_id}: {e}")
            failed += 1

        if i < len(sorted_missing):
            await asyncio.sleep(DELAY_BETWEEN_REVIEWS)

    logger.info(f"\nBatch complete: {generated} generated, {failed} failed, {len(existing)} already existed")


if __name__ == "__main__":
    asyncio.run(main())
