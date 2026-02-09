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

    logger.info(f"🏁 Daily sync seeding complete: {generated} generated, {failed} failed")
    
    # ─── STEP 2: Smart Refresh ───
    logger.info("🔄 Starting Smart Refresh for recent movies...")
    refresh_stats = await smart_refresh(db, max_refresh=10)
    
    return {
        "generated": generated, 
        "failed": failed, 
        "total_new": len(new_items),
        "refreshed": refresh_stats["refreshed"],
        "refresh_failed": refresh_stats["failed"]
    }


async def smart_refresh(db: AsyncSession, max_refresh: int = 10):
    """
    Re-review movies based on age and staleness.
    
    Rules:
    - Released < 14 days ago:  refresh if review is > 24 hours old
    - Released 14-30 days ago: refresh if review is > 3 days old
    - Released 30-90 days ago: refresh if review is > 7 days old  
    - Released 90+ days ago:   NEVER refresh (consensus is locked)
    """
    from datetime import date, datetime, timedelta
    from sqlalchemy.orm import joinedload
    
    today = date.today()
    now = datetime.utcnow()
    
    # Query movies with reviews, ordered by release date (newest first)
    result = await db.execute(
        select(Movie)
        .options(joinedload(Movie.review))
        .where(Movie.release_date.isnot(None))
        .order_by(Movie.release_date.desc())
    )
    movies = result.unique().scalars().all()
    
    candidates = []
    
    for movie in movies:
        if not movie.review or not movie.release_date:
            continue
        
        days_since_release = (today - movie.release_date).days
        review_age = now - movie.review.generated_at if movie.review.generated_at else timedelta(days=999)
        review_age_hours = review_age.total_seconds() / 3600
        
        needs_refresh = False
        reason = ""
        
        # Brand new (< 14 days): refresh every 24 hours
        if days_since_release < 14:
            if review_age_hours > 24:
                needs_refresh = True
                reason = f"New release ({days_since_release}d old), review is {review_age_hours:.0f}h old"
        
        # Recent (14-30 days): refresh every 3 days
        elif days_since_release < 30:
            if review_age_hours > 72:
                needs_refresh = True
                reason = f"Recent ({days_since_release}d old), review is {review_age_hours/24:.0f}d old"
        
        # Settling (30-90 days): refresh every 7 days
        elif days_since_release < 90:
            if review_age_hours > 168:
                needs_refresh = True
                reason = f"Settling ({days_since_release}d old), review is {review_age_hours/24:.0f}d old"
        
        # Old (90+ days): skip — consensus is locked
        else:
            continue
        
        if needs_refresh:
            candidates.append((movie, reason))
    
    if not candidates:
        logger.info("🔄 Smart Refresh: No movies need refreshing")
        return {"refreshed": 0, "failed": 0}
    
    logger.info(f"🔄 Smart Refresh: {len(candidates)} movies need refreshing (processing max {max_refresh})")
    
    refreshed = 0
    failed = 0
    
    for movie, reason in candidates[:max_refresh]:
        try:
            logger.info(f"🔄 Refreshing: {movie.title} — {reason}")
            # Re-generate review (this overwrites the existing one in place or updates logic)
            # Ensure generate_review_for_movie handles updates correctly
            await generate_review_for_movie(db, movie)
            await db.commit()
            refreshed += 1
        except Exception as e:
            await db.rollback()
            failed += 1
            logger.error(f"❌ Refresh failed for {movie.title}: {e}")
    
    logger.info(f"🔄 Smart Refresh complete: {refreshed} refreshed, {failed} failed")
    return {"refreshed": refreshed, "failed": failed}
