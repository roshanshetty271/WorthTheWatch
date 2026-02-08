"""
Worth the Watch? — FastAPI Application
"Should I stream this? The internet decides."
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

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
    yield
    logger.info("👋 Shutting down...")


# ─── App ──────────────────────────────────────────────────

app = FastAPI(
    title="Worth the Watch? API",
    description="AI-powered movie review aggregation. The internet decides.",
    version="1.0.0",
    lifespan=lifespan,
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

app.include_router(movies.router, prefix="/api")
app.include_router(search.router, prefix="/api")


# ─── Health Check ─────────────────────────────────────────

@app.get("/health", response_model=HealthCheck)
async def health_check():
    return HealthCheck()


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
    if secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid cron secret")

    result = await run_daily_sync(db, max_new=20)
    return {"status": "completed", **result}


# ─── Seed Endpoint (dev only) ─────────────────────────────

@app.post("/api/seed")
async def seed_database(
    count: int = 50,
    secret: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Seed the database with trending titles. For initial setup only."""
    if secret != settings.CRON_SECRET:
        raise HTTPException(status_code=403, detail="Invalid secret")

    result = await run_daily_sync(db, max_new=count)
    return {"status": "seeded", **result}
