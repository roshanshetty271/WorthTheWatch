"""
Worth the Watch? — FastAPI Application
"Should I stream this? The internet decides."
"""

import gc
import logging
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import get_settings
from app.database import init_db, get_db
from app.models import Movie, Review, SearchEvent, ReviewFeedback, RateLimitEntry, GenerationUsageEntry  # noqa: F401
from app.routers import movies, search, versus, nowplaying, discover, feedback
from app.jobs.daily_sync import run_daily_sync
from app.middleware.rate_limit import cleanup_old_rate_limit_entries
from app.schemas import HealthCheck

settings = get_settings()

# ─── Logging ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: cleanup."""
    logger.info("🎬 Worth the Watch? — Starting up...")
    await init_db()
    logger.info("✅ Database initialized")

    if settings.ENVIRONMENT == "production" and not settings.INTERNAL_PROXY_SECRET:
        logger.warning("⚠️ INTERNAL_PROXY_SECRET is not set — proxy quota path is disabled!")
    
    from app.services.tmdb import tmdb_service
    import asyncio
    asyncio.create_task(tmdb_service.refresh_popular_cache())
    
    yield
    logger.info("👋 Shutting down...")


# ─── App ──────────────────────────────────────────────────

app = FastAPI(
    title="Worth the Watch? API",
    description="AI-powered movie review aggregation. The internet decides.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
)


# ─── Global Error Handler ─────────────────────────────────
# SECURITY: Never leak tracebacks, table names, or file paths to clients.

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# CORS — allow frontend origins
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# ─── Routers ──────────────────────────────────────────────

app.include_router(movies.router, prefix="/api/movies", tags=["movies"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(versus.router, prefix="/api/versus", tags=["versus"])
app.include_router(nowplaying.router, prefix="/api/nowplaying", tags=["nowplaying"])
app.include_router(discover.router, prefix="/api/discover", tags=["discover"])
app.include_router(feedback.router, prefix="/api/reviews", tags=["feedback"])


# ─── Sitemap (SEO) ────────────────────────────────────────

@app.get("/api/sitemap")
async def get_sitemap_data(db: AsyncSession = Depends(get_db)):
    """Returns all reviewed movie IDs for sitemap generation."""
    result = await db.execute(
        select(Movie.tmdb_id, Movie.title, Movie.media_type, Review.generated_at)
        .join(Review)
        .order_by(desc(Review.generated_at))
    )
    rows = result.all()
    return [
        {
            "tmdb_id": r.tmdb_id,
            "title": r.title,
            "media_type": r.media_type or "movie",
            "updated_at": r.generated_at.isoformat(),
        }
        for r in rows
    ]


def _get_admin_secret(request: Request, secret: str = "") -> str:
    """Read admin secret from header first, fall back to query param."""
    return request.headers.get("x-admin-secret", "") or secret


# ─── Health Check ─────────────────────────────────────────

@app.get("/health", response_model=HealthCheck)
async def health_check(
    request: Request,
    check_services: bool = False,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    if not check_services:
        return HealthCheck(status="ok")
    
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret for deep check")

    health_status = {
        "status": "ok", 
        "database": "unknown",
        "tmdb": "unknown",
        "llm": "unknown",
        "serper": "unknown"
    }

    try:
        await db.execute(select(1))
        health_status["database"] = "connected"
    except Exception as e:
        logger.error(f"Health DB fail: {e}")
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"

    try:
        from app.services.tmdb import tmdb_service
        await tmdb_service.get_movie_details(550)
        health_status["tmdb"] = "connected"
    except Exception as e:
        logger.error(f"Health TMDB fail: {e}")
        health_status["tmdb"] = "disconnected"
        health_status["status"] = "degraded"

    try:
        if settings.OPENAI_API_KEY or settings.DEEPSEEK_API_KEY:
             from app.services.llm import llm_client, llm_model
             await llm_client.chat.completions.create(
                 model=llm_model,
                 messages=[{"role": "user", "content": "hi"}],
                 max_tokens=1
             )
             health_status["llm"] = "connected"
        else:
             health_status["llm"] = "not_configured"
    except Exception as e:
        logger.error(f"Health LLM fail: {e}")
        health_status["llm"] = "error"
        health_status["status"] = "degraded"

    try:
        if settings.SERPER_API_KEY:
            from app.services.serper import serper_service
            await serper_service.search_reviews("test", "2024", "movie")
            health_status["serper"] = "connected"
        else:
            health_status["serper"] = "not_configured"
    except Exception as e:
        logger.error(f"Health Serper fail: {e}")
        health_status["serper"] = "error"
        health_status["status"] = "degraded"

    return HealthCheck(**health_status)


# ─── Cron Endpoint ────────────────────────────────────────

@app.post("/api/cron/daily")
async def cron_daily(
    request: Request,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    
    await cleanup_old_rate_limit_entries()
    result = await run_daily_sync(db, max_new=20)
    return {"status": "completed", **result}


@app.post("/api/refresh")
async def manual_refresh(
    request: Request,
    secret: str = "",
    max_refresh: int = 10,
    background_tasks: BackgroundTasks = None,
):
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    background_tasks.add_task(_refresh_background, max_refresh)
    return {"status": "started", "max_refresh": max_refresh}


async def _refresh_background(max_refresh: int):
    from app.database import async_session
    from app.jobs.daily_sync import smart_refresh
    
    async with async_session() as db:
        try:
            result = await smart_refresh(db, max_refresh=max_refresh)
            logger.info(f"🔄 Manual refresh result: {result}")
        except Exception as e:
            logger.error(f"❌ Manual refresh failed: {e}")


# ─── Admin: Usage Stats ──────────────────────────────────

@app.get("/api/admin/usage-stats")
async def usage_stats(
    request: Request,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Dashboard snapshot: generations today/hour, top IPs, suspicious activity."""
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    from datetime import datetime, timedelta
    from sqlalchemy import func, distinct

    now = datetime.utcnow()
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    gen_today = (await db.execute(
        select(func.count()).select_from(GenerationUsageEntry)
        .where(GenerationUsageEntry.created_at > day_ago)
    )).scalar() or 0

    gen_hour = (await db.execute(
        select(func.count()).select_from(GenerationUsageEntry)
        .where(GenerationUsageEntry.created_at > hour_ago)
    )).scalar() or 0

    top_ips_rows = (await db.execute(
        select(
            GenerationUsageEntry.ip_hash,
            func.count().label("count"),
            func.count(distinct(GenerationUsageEntry.actor_id)).label("distinct_actors"),
        )
        .where(GenerationUsageEntry.created_at > day_ago)
        .group_by(GenerationUsageEntry.ip_hash)
        .order_by(func.count().desc())
        .limit(5)
    )).all()

    return {
        "generated_today": gen_today,
        "generated_this_hour": gen_hour,
        "daily_limit": settings.DAILY_GENERATION_LIMIT,
        "hourly_limit": settings.HOURLY_GLOBAL_LIMIT,
        "daily_pct": round(gen_today / settings.DAILY_GENERATION_LIMIT * 100, 1),
        "hourly_pct": round(gen_hour / settings.HOURLY_GLOBAL_LIMIT * 100, 1),
        "top_ips_today": [
            {
                "ip_hash": row.ip_hash,
                "generations": row.count,
                "distinct_actors": row.distinct_actors,
                "suspicious": row.distinct_actors > 5 and row.count > 15,
            }
            for row in top_ips_rows
        ],
    }


# ─── Admin: Reset Quotas ──────────────────────────────────

@app.post("/api/admin/reset-quotas")
async def reset_quotas(
    request: Request,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Reset all generation quotas. Everyone gets a fresh start."""
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    from sqlalchemy import delete as sa_delete
    result = await db.execute(sa_delete(GenerationUsageEntry))
    await db.commit()
    logger.info(f"🔄 Admin reset: cleared {result.rowcount} generation usage entries")
    return {"status": "reset", "deleted": result.rowcount}


# ─── Seed Endpoint (dev only) ─────────────────────────────

@app.post("/api/seed")
async def seed_database(
    request: Request,
    count: int = 50,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    result = await run_daily_sync(db, max_new=count)
    return {"status": "seeded", **result}


# ─── Delete Movie Endpoint (Maintenance) ──────────────────

@app.delete("/api/movies/{tmdb_id}")
async def delete_movie(
    tmdb_id: int,
    request: Request,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    result = await db.execute(
        select(Movie).where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    
    title = movie.title
    await db.delete(movie)
    await db.commit()
    return {"status": "deleted", "title": title, "tmdb_id": tmdb_id}


# ─── Regenerate Endpoint (Maintenance) ─────────────────────
# OOM FIX: Processes in batches of 20 with gc.collect() between batches.
# Each batch opens its own DB session and closes it when done.
# This keeps memory usage under 512MB on Koyeb free tier.

REGEN_BATCH_SIZE = 20

@app.post("/api/regenerate")
async def regenerate_all_reviews(
    request: Request,
    secret: str = "",
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Re-generate all existing reviews with the current prompt."""
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    from sqlalchemy.orm import joinedload

    result = await db.execute(
        select(Movie).options(joinedload(Movie.review))
    )
    all_movies = result.unique().scalars().all()
    movies_with_reviews = [m for m in all_movies if m.review is not None]
    tmdb_ids = [m.tmdb_id for m in movies_with_reviews]

    background_tasks.add_task(_regenerate_background, tmdb_ids)

    return {
        "status": "started",
        "message": f"Regenerating {len(tmdb_ids)} reviews in batches of {REGEN_BATCH_SIZE}. Watch server logs.",
        "count": len(tmdb_ids),
    }


async def _regenerate_background(tmdb_ids: list[int]):
    """
    Background task: regenerate reviews in batches.
    Each batch gets its own DB session which is closed after the batch.
    gc.collect() runs between batches to free memory.
    This prevents OOM on 512MB Koyeb instances.
    """
    from app.database import async_session
    from app.services.pipeline import generate_review_for_movie

    total = len(tmdb_ids)
    regenerated = 0
    failed = 0

    logger.info(f"🔄 Regeneration started: {total} movies in batches of {REGEN_BATCH_SIZE}")

    for batch_start in range(0, total, REGEN_BATCH_SIZE):
        batch = tmdb_ids[batch_start:batch_start + REGEN_BATCH_SIZE]
        batch_num = batch_start // REGEN_BATCH_SIZE + 1
        total_batches = (total + REGEN_BATCH_SIZE - 1) // REGEN_BATCH_SIZE

        logger.info(f"📦 Batch {batch_num}/{total_batches} — processing {len(batch)} movies")

        for tmdb_id in batch:
            # Each movie gets its own session to avoid session bloat
            async with async_session() as db:
                try:
                    result = await db.execute(
                        select(Movie).where(Movie.tmdb_id == tmdb_id)
                    )
                    movie = result.scalar_one_or_none()
                    if movie:
                        logger.info(f"♻️ [{regenerated + failed + 1}/{total}] Regenerating: {movie.title}")
                        await generate_review_for_movie(db, movie)
                        await db.commit()
                        regenerated += 1
                except Exception as e:
                    await db.rollback()
                    failed += 1
                    logger.error(f"❌ Failed tmdb_id {tmdb_id}: {e}")

        # Free memory between batches
        gc.collect()
        logger.info(f"✅ Batch {batch_num}/{total_batches} done. Memory freed. Progress: {regenerated} success, {failed} failed")

    logger.info(f"🏁 Regeneration complete: {regenerated} success, {failed} failed out of {total}")


# ─── Seed Top-Rated Endpoint ─────────────────────────────

@app.post("/api/seed-top-rated")
async def seed_top_rated(
    request: Request,
    pages: int = 10,
    media_type: str = "movie",
    secret: str = "",
    background_tasks: BackgroundTasks = None,
):
    if not secrets.compare_digest(_get_admin_secret(request, secret), settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    if media_type not in ("movie", "tv"):
        raise HTTPException(status_code=400, detail="media_type must be 'movie' or 'tv'")
    
    pages = min(max(pages, 1), 20)
    
    background_tasks.add_task(_seed_top_rated_background, pages, media_type)
    return {
        "status": "started",
        "message": f"Seeding ~{pages * 20} top-rated {media_type}s in background. Watch server logs.",
    }


async def _seed_top_rated_background(pages: int, media_type: str):
    from app.database import async_session
    from app.services.tmdb import tmdb_service
    from app.services.pipeline import get_or_create_movie, generate_review_for_movie
    
    try:
        generated = 0
        skipped = 0
        failed = 0
        
        for page in range(1, pages + 1):
            try:
                if media_type == "movie":
                    results = await tmdb_service.get_top_rated_movies(page)
                else:
                    results = await tmdb_service.get_top_rated_tv(page)
                
                for item in results:
                    tmdb_id = item["id"]
                    title = item.get("title") or item.get("name", "Unknown")
                    
                    async with async_session() as db:
                        existing = await db.execute(
                            select(Movie).where(Movie.tmdb_id == tmdb_id)
                        )
                        if existing.scalar_one_or_none():
                            skipped += 1
                            continue
                        
                        try:
                            movie = await get_or_create_movie(db, tmdb_id, media_type)
                            await generate_review_for_movie(db, movie)
                            await db.commit()
                            generated += 1
                            logger.info(f"⭐ [{generated}] Top rated {media_type}: {title}")
                        except Exception as e:
                            await db.rollback()
                            failed += 1
                            logger.error(f"❌ Failed: {title} — {e}")
                
                # Free memory after each page
                gc.collect()
                            
            except Exception as e:
                logger.error(f"❌ Failed to fetch page {page}: {e}")
        
        logger.info(f"🏁 Top rated seed complete: {generated} new, {skipped} skipped, {failed} failed")
    except Exception as e:
        logger.critical(f"🚨 Seed top rated task crashed: {e}")