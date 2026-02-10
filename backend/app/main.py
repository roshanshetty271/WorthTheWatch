"""
Worth the Watch? — FastAPI Application
"Should I stream this? The internet decides."
"""

import logging
import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import get_settings
from app.database import init_db, get_db
from app.models import Movie, Review, SearchEvent  # noqa: F401 — ensure models registered for init_db
from app.routers import movies, search
from app.jobs.daily_sync import run_daily_sync
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
    
    # Warm up fuzzy search cache in background
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

# CORS — allow frontend origins
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────

app.include_router(movies.router, prefix="/api/movies", tags=["movies"])
app.include_router(search.router, prefix="/api", tags=["search"])


# ─── Health Check ─────────────────────────────────────────

@app.get("/health", response_model=HealthCheck)
async def health_check(
    check_services: bool = False,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Health check endpoint.
    - Standard: Returns simple "ok".
    - Deep: Checks DB, TMDB, LLM, Serper (requires secret).
    """
    if not check_services:
        return HealthCheck(status="ok")
    
    # Verify secret for deep check (prevents valid credit drain)
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret for deep check")

    health_status = {
        "status": "ok", 
        "database": "unknown",
        "tmdb": "unknown",
        "llm": "unknown",
        "serper": "unknown"
    }

    # 1. Database Check
    try:
        await db.execute(select(1))
        health_status["database"] = "connected"
    except Exception as e:
        logger.error(f"Health DB fail: {e}")
        health_status["database"] = "disconnected"
        health_status["status"] = "degraded"

    # 2. TMDB Check (Fetch config - lightweight)
    try:
        from app.services.tmdb import tmdb_service
        await tmdb_service.get_movie_details(550) # Fight Club
        health_status["tmdb"] = "connected"
    except Exception as e:
        logger.error(f"Health TMDB fail: {e}")
        health_status["tmdb"] = "disconnected"
        health_status["status"] = "degraded"

    # 3. LLM Check (Simple generation)
    try:
        if settings.OPENAI_API_KEY or settings.DEEPSEEK_API_KEY:
             # Just check if client is initialized, don't burn generation credits unnecessarily
             # unless we explicitly want to test the API key validity.
             # User asked to "monitor if... you've run out of credits"
             # So we MUST try a minimal call.
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

    # 4. Serper Check (Simple search)
    try:
        if settings.SERPER_API_KEY:
            from app.services.serper import serper_service
            # This costs 1 credit. Use sparingly.
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
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """
    Daily sync endpoint. Called by external cron (cron-job.org).
    Protected by CRON_SECRET to prevent unauthorized triggers.
    """
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid cron secret")
    
    result = await run_daily_sync(db, max_new=20)
    return {"status": "completed", **result}


@app.post("/api/refresh")
async def manual_refresh(
    secret: str = "",
    max_refresh: int = 10,
    background_tasks: BackgroundTasks = None,
):
    """Manually trigger Smart Refresh for recent movies."""
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
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


# ─── Seed Endpoint (dev only) ─────────────────────────────

@app.post("/api/seed")
async def seed_database(
    count: int = 50,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with trending titles. For initial setup only."""
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    result = await run_daily_sync(db, max_new=count)
    return {"status": "seeded", **result}


# ─── Delete Movie Endpoint (Maintenance) ──────────────────

@app.delete("/api/movies/{tmdb_id}")
async def delete_movie(
    tmdb_id: int,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Delete a movie and its review from the database."""
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
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

# ─── Regenerate Endpoint (Maintenance) ─────────────────────

@app.post("/api/regenerate")
async def regenerate_all_reviews(
    secret: str = "",
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Re-generate all existing reviews with the current prompt."""
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")

    from sqlalchemy import select
    from sqlalchemy.orm import joinedload

    # Count how many movies need regeneration
    result = await db.execute(
        select(Movie).options(joinedload(Movie.review))
    )
    all_movies = result.unique().scalars().all()
    movies_with_reviews = [m for m in all_movies if m.review is not None]

    # Get the TMDB IDs to pass to background task (can't pass ORM objects)
    tmdb_ids = [m.tmdb_id for m in movies_with_reviews]

    # Run in background — return immediately
    background_tasks.add_task(_regenerate_background, tmdb_ids)

    return {
        "status": "started",
        "message": f"Regenerating {len(tmdb_ids)} reviews in background. Watch the server logs.",
        "count": len(tmdb_ids),
    }


async def _regenerate_background(tmdb_ids: list[int]):
    """Background task: regenerate reviews for given TMDB IDs."""
    from app.database import async_session
    from app.services.pipeline import generate_review_for_movie

    try:
        total = len(tmdb_ids)
        regenerated = 0
        failed = 0
        logger.info(f"🔄 Background regeneration started for {total} movies")

        for i, tmdb_id in enumerate(tmdb_ids):
            async with async_session() as db:
                try:
                    result = await db.execute(
                        select(Movie).where(Movie.tmdb_id == tmdb_id)
                    )
                    movie = result.scalar_one_or_none()
                    if movie:
                        logger.info(f"♻️ [{i+1}/{total}] Regenerating: {movie.title}")
                        await generate_review_for_movie(db, movie)
                        await db.commit()
                        regenerated += 1
                except Exception as e:
                    await db.rollback()
                    failed += 1
                    logger.error(f"❌ Failed to regenerate tmdb_id {tmdb_id}: {e}")

        logger.info(f"🏁 Regeneration complete: {regenerated} success, {failed} failed out of {total}")
    except Exception as e:
        logger.critical(f"🚨 Regeneration task crashed: {e}")


# ─── Seed Top-Rated Endpoint ─────────────────────────────

@app.post("/api/seed-top-rated")
async def seed_top_rated(
    pages: int = 10,
    media_type: str = "movie",
    secret: str = "",
    background_tasks: BackgroundTasks = None,
):
    """
    Seed database with top-rated movies/TV from TMDB.
    Each page = 20 items. 10 pages = 200 top items.
    
    Args:
        pages: Number of pages to fetch (1-20)
        media_type: "movie" or "tv"
        secret: CRON_SECRET for authorization
    """
    if not secrets.compare_digest(secret, settings.CRON_SECRET):
        raise HTTPException(status_code=403, detail="Invalid secret")
    
    if media_type not in ("movie", "tv"):
        raise HTTPException(status_code=400, detail="media_type must be 'movie' or 'tv'")
    
    pages = min(max(pages, 1), 20)  # Clamp 1-20
    
    background_tasks.add_task(_seed_top_rated_background, pages, media_type)
    return {
        "status": "started",
        "message": f"Seeding ~{pages * 20} top-rated {media_type}s in background. Watch server logs.",
    }


async def _seed_top_rated_background(pages: int, media_type: str):
    """Background task: fetch top-rated content from TMDB and generate reviews."""
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
                        # Skip if already in database
                        existing = await db.execute(
                            select(Movie).where(Movie.tmdb_id == tmdb_id)
                        )
                        if existing.scalar_one_or_none():
                            skipped += 1
                            logger.debug(f"⏭️ Skipping (exists): {title}")
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
                            
            except Exception as e:
                logger.error(f"❌ Failed to fetch page {page}: {e}")
        
        logger.info(f"🏁 Top rated seed complete: {generated} new, {skipped} skipped, {failed} failed")
    except Exception as e:
        logger.critical(f"🚨 Seed top rated task crashed: {e}")

