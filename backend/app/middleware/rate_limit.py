"""
Worth the Watch? — Rate Limiting Middleware
DB-persistent rate limiter using Neon PostgreSQL.
Survives server restarts and redeployments.
"""

import hashlib
import os
from datetime import datetime, timedelta

from fastapi import Request, HTTPException
from sqlalchemy import select, func, delete

from app.config import get_settings
from app.database import async_session
from app.models import RateLimitEntry

settings = get_settings()

IP_HASH_SALT = os.getenv("IP_HASH_SALT", "wtw-default-salt-change-in-prod")

_LIMIT_MAP = {
    "generation": {
        "per_ip_per_hour": settings.ON_DEMAND_PER_IP_PER_HOUR,
        "per_ip_per_day": settings.ON_DEMAND_PER_IP_PER_DAY,
        "counts_toward_daily_global": True,
    },
    "battle": {
        "per_ip_per_hour": settings.BATTLE_PER_IP_PER_DAY,
        "per_ip_per_day": settings.BATTLE_PER_IP_PER_DAY,
        "counts_toward_daily_global": True,
    },
    "roulette": {
        "per_ip_per_hour": settings.ROULETTE_PER_IP_PER_DAY,
        "per_ip_per_day": settings.ROULETTE_PER_IP_PER_DAY,
        "counts_toward_daily_global": False,
    },
}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",")]
        return ips[0] if ips else "unknown"
    return request.client.host if request.client else "unknown"


def _hash_ip(raw_ip: str) -> str:
    return hashlib.sha256(f"{IP_HASH_SALT}:{raw_ip}".encode()).hexdigest()[:16]


def _is_whitelisted(ip: str) -> bool:
    raw = settings.RATE_LIMIT_WHITELIST
    if not raw:
        return False
    return ip in {s.strip() for s in raw.split(",") if s.strip()}


async def check_rate_limit(request: Request, limit_type: str = "generation"):
    """Check rate limits using persistent DB storage. Raises 429 if exceeded."""
    raw_ip = _get_client_ip(request)
    if _is_whitelisted(raw_ip):
        return

    hashed_ip = _hash_ip(raw_ip)
    now = datetime.utcnow()
    config = _LIMIT_MAP.get(limit_type, _LIMIT_MAP["generation"])

    async with async_session() as db:
        # Global daily generation limit
        if config["counts_toward_daily_global"]:
            day_ago = now - timedelta(hours=24)
            global_day_count = (await db.execute(
                select(func.count()).select_from(RateLimitEntry).where(
                    RateLimitEntry.created_at > day_ago,
                )
            )).scalar() or 0

            if global_day_count >= settings.DAILY_GENERATION_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "type": "global_daily_limit",
                        "message": "Our servers are at capacity for today. Try again tomorrow.",
                        "retry_after_seconds": 3600,
                        "limit_type": limit_type,
                    },
                )

        # Global hourly cap
        hour_ago = now - timedelta(hours=1)
        global_hour_count = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.created_at > hour_ago,
            )
        )).scalar() or 0

        if global_hour_count >= settings.HOURLY_GLOBAL_LIMIT:
            raise HTTPException(
                status_code=429,
                detail={
                    "type": "global_hourly_limit",
                    "message": "Worth the Watch is buzzing right now! Check back shortly.",
                    "retry_after_seconds": 600,
                    "limit_type": limit_type,
                },
            )

        # Per-IP hourly limit
        ip_hour_count = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.ip_hash == hashed_ip,
                RateLimitEntry.limit_type == limit_type,
                RateLimitEntry.created_at > hour_ago,
            )
        )).scalar() or 0

        if ip_hour_count >= config["per_ip_per_hour"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "type": "ip_hourly_limit",
                    "message": "Hourly limit reached. Try again shortly.",
                    "retry_after_seconds": 600,
                    "limit_type": limit_type,
                },
            )

        # Per-IP daily limit
        day_ago = now - timedelta(hours=24)
        ip_day_count = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.ip_hash == hashed_ip,
                RateLimitEntry.limit_type == limit_type,
                RateLimitEntry.created_at > day_ago,
            )
        )).scalar() or 0

        if ip_day_count >= config["per_ip_per_day"]:
            raise HTTPException(
                status_code=429,
                detail={
                    "type": "ip_daily_limit",
                    "message": "Daily limit reached. Try again tomorrow.",
                    "retry_after_seconds": 3600,
                    "limit_type": limit_type,
                },
            )

        # Record this request
        db.add(RateLimitEntry(
            ip_hash=hashed_ip,
            limit_type=limit_type,
            created_at=now,
        ))
        await db.commit()


async def cleanup_old_rate_limit_entries():
    """Delete rate limit entries older than 48 hours. Call from cron."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    async with async_session() as db:
        await db.execute(
            delete(RateLimitEntry).where(RateLimitEntry.created_at < cutoff)
        )
        await db.commit()
