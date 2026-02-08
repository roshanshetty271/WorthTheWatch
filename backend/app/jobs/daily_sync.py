"""
Worth the Watch? — Daily Sync Job
Fetches trending + upcoming titles from TMDB, generates reviews for new ones.
Called by external cron (cron-job.org) hitting POST /cron/daily.
"""

import logging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Movie
from app.services.tmdb import tmdb_service
from app.services.pipeline import get_or_create_movie, generate_review_for_movie

logger = logging.getLogger(__name__)


async def run_daily_sync(db: AsyncSession, max_new: int = 20):
    """
    Daily sync:
    1. Fetch trending movies + TV from TMDB
    2. Fetch upcoming movies (pre-computation trick)
    3. For each new title not in DB, generate a review
    """
    logger.info("🚀 Starting daily sync...")

    # Gather titles from multiple TMDB endpoints
    all_items = []

    try:
        trending = await tmdb_service.get_trending("all", "day")
        all_items.extend([(item, item.get("media_type", "movie")) for item in trending[:20]])
        logger.info(f"  Trending: {len(trending)} titles")
    except Exception as e:
        logger.error(f"  Failed to fetch trending: {e}")

    try:
        now_playing = await tmdb_service.get_now_playing()
        all_items.extend([(item, "movie") for item in now_playing[:10]])
        logger.info(f"  Now playing: {len(now_playing)} titles")
    except Exception as e:
        logger.error(f"  Failed to fetch now_playing: {e}")

    try:
        upcoming = await tmdb_service.get_upcoming()
        all_items.extend([(item, "movie") for item in upcoming[:10]])
        logger.info(f"  Upcoming: {len(upcoming)} titles")
    except Exception as e:
        logger.error(f"  Failed to fetch upcoming: {e}")

    try:
        popular_tv = await tmdb_service.get_popular_tv()
        all_items.extend([(item, "tv") for item in popular_tv[:10]])
        logger.info(f"  Popular TV: {len(popular_tv)} titles")
    except Exception as e:
        logger.error(f"  Failed to fetch popular TV: {e}")

    # Deduplicate by TMDB ID
    seen_ids = set()
    unique_items = []
    for item, media_type in all_items:
        tmdb_id = item.get("id")
        if tmdb_id and tmdb_id not in seen_ids:
            seen_ids.add(tmdb_id)
            unique_items.append((item, media_type))

    logger.info(f"📋 {len(unique_items)} unique titles to process")

    # Check which ones are already in our DB
    existing_ids_result = await db.execute(select(Movie.tmdb_id))
    existing_ids = set(row[0] for row in existing_ids_result.all())

    new_items = [(item, mt) for item, mt in unique_items if item["id"] not in existing_ids]
    logger.info(f"🆕 {len(new_items)} new titles to generate reviews for")

    # Process up to max_new new titles
    generated = 0
    failed = 0

    for item, media_type in new_items[:max_new]:
        tmdb_id = item["id"]
        title = item.get("title") or item.get("name", "Unknown")

        try:
            movie = await get_or_create_movie(db, tmdb_id, media_type)
            await generate_review_for_movie(db, movie)
            await db.commit()
            generated += 1
            logger.info(f"  ✅ [{generated}/{max_new}] {title}")
        except Exception as e:
            await db.rollback()
            failed += 1
            logger.error(f"  ❌ Failed: {title} — {e}")

    logger.info(f"🏁 Daily sync complete: {generated} generated, {failed} failed")
    return {"generated": generated, "failed": failed, "total_new": len(new_items)}
