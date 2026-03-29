"""
Worth the Watch? — Rate Limiting Middleware
DB-persistent rate limiter using Neon PostgreSQL.
Survives server restarts and redeployments.
"""

import hashlib
from datetime import datetime, timedelta

from fastapi import Request, HTTPException
from sqlalchemy import select, func, delete, distinct

from app.config import get_settings
from app.database import async_session
from app.models import RateLimitEntry, GenerationUsageEntry

settings = get_settings()

_LIMIT_MAP = {
    "generation": {
        "per_ip_per_hour": settings.ON_DEMAND_PER_IP_PER_HOUR,
        "per_ip_per_day": settings.ON_DEMAND_PER_IP_PER_DAY,
        "counts_toward_daily_global": True,
    },
    "battle": {
        "per_ip_per_hour": settings.BATTLE_PER_IP_PER_HOUR,
        "per_ip_per_day": settings.BATTLE_PER_IP_PER_DAY,
        "counts_toward_daily_global": True,
    },
    "roulette": {
        "per_ip_per_hour": settings.ROULETTE_PER_IP_PER_HOUR,
        "per_ip_per_day": settings.ROULETTE_PER_IP_PER_DAY,
        "counts_toward_daily_global": False,
    },
}


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        # Rightmost IP is the one added by the trusted proxy (Koyeb).
        # Leftmost is client-controlled and trivially spoofable.
        return ips[-1] if ips else "unknown"
    return request.client.host if request.client else "unknown"


def _hash_ip(raw_ip: str) -> str:
    return hashlib.sha256(f"{settings.IP_HASH_SALT}:{raw_ip}".encode()).hexdigest()[:16]


def _is_whitelisted(ip: str) -> bool:
    raw = settings.RATE_LIMIT_WHITELIST
    if not raw:
        return False
    return ip in {s.strip() for s in raw.split(",") if s.strip()}


async def check_rate_limit(request: Request, limit_type: str = "generation"):
    """Check rate limits using persistent DB storage. Raises 429 if exceeded."""
    raw_ip = _get_client_ip(request)
    whitelisted = _is_whitelisted(raw_ip)
    import logging
    logging.getLogger("app.rate_limit").info(
        f"🔒 Rate limit check: ip={raw_ip}, whitelisted={whitelisted}, type={limit_type}, "
        f"x-forwarded-for={request.headers.get('x-forwarded-for', 'none')}"
    )
    if whitelisted:
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


ANON_GENERATION_LIMIT = 3
USER_GENERATION_LIMIT = 20
IP_ABUSE_WINDOW_MINUTES = 60
IP_ABUSE_THRESHOLD = 100
IP_DAILY_CAP = 500

logger = __import__("logging").getLogger("app.quota")


async def check_generation_quota(actor_type: str, actor_id: str) -> dict:
    """Check generation quota for an actor. Returns quota status dict, never raises."""
    if actor_type == "user":
        limit = USER_GENERATION_LIMIT
        window = timedelta(hours=24)
    else:
        limit = ANON_GENERATION_LIMIT
        window = None  # lifetime for anonymous

    async with async_session() as db:
        query = select(func.count()).select_from(GenerationUsageEntry).where(
            GenerationUsageEntry.actor_type == actor_type,
            GenerationUsageEntry.actor_id == actor_id,
        )
        if window:
            query = query.where(
                GenerationUsageEntry.created_at > datetime.utcnow() - window
            )
        used = (await db.execute(query)).scalar() or 0

    remaining = max(0, limit - used)
    exhausted = used >= limit
    logger.info(
        f"quota_check: actor_type={actor_type}, actor_id_prefix={actor_id[:8]}..., "
        f"used={used}, limit={limit}, exhausted={exhausted}"
    )
    return {
        "actor_type": actor_type,
        "limit": limit,
        "used": used,
        "remaining": remaining,
        "exhausted": exhausted,
        "window_type": "rolling_24h" if actor_type == "user" else "lifetime",
    }


async def record_generation_usage(
    actor_type: str, actor_id: str, ip_hash: str, action: str, tmdb_id: int
):
    """Record a generation usage entry + a RateLimitEntry for abuse/global cap tracking."""
    now = datetime.utcnow()
    async with async_session() as db:
        db.add(GenerationUsageEntry(
            actor_type=actor_type,
            actor_id=actor_id,
            ip_hash=ip_hash,
            action=action,
            tmdb_id=tmdb_id,
            created_at=now,
        ))
        db.add(RateLimitEntry(
            ip_hash=ip_hash,
            limit_type="generation",
            created_at=now,
        ))
        await db.commit()

        if actor_type == "anon":
            recent_cutoff = now - timedelta(minutes=10)
            distinct_anons = (await db.execute(
                select(func.count(distinct(GenerationUsageEntry.actor_id))).where(
                    GenerationUsageEntry.ip_hash == ip_hash,
                    GenerationUsageEntry.actor_type == "anon",
                    GenerationUsageEntry.created_at > recent_cutoff,
                )
            )).scalar() or 0
            if distinct_anons > 5:
                logger.warning(
                    f"SUSPICIOUS cookie_rotation: ip_hash={ip_hash}, "
                    f"distinct_anon_ids_10min={distinct_anons}"
                )

    logger.info(
        f"quota_recorded: actor_type={actor_type}, action={action}, tmdb_id={tmdb_id}"
    )


async def check_ip_abuse_guard(ip_hash: str) -> dict:
    """Check per-IP burst protection + global caps. Returns dict with 'blocked' and details."""
    now = datetime.utcnow()
    async with async_session() as db:
        # Global daily cap
        day_ago = now - timedelta(hours=24)
        global_day = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.created_at > day_ago,
            )
        )).scalar() or 0
        if global_day >= int(settings.DAILY_GENERATION_LIMIT * 0.7):
            logger.warning(
                f"SUSPICIOUS global_daily_approaching: {global_day}/{settings.DAILY_GENERATION_LIMIT}"
            )
        if global_day >= settings.DAILY_GENERATION_LIMIT:
            return {
                "blocked": True,
                "type": "global_daily_limit",
                "message": "Our servers are at capacity for today. Try again tomorrow.",
                "retry_after_seconds": 3600,
            }

        # Global hourly cap
        hour_ago = now - timedelta(hours=1)
        global_hour = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.created_at > hour_ago,
            )
        )).scalar() or 0
        if global_hour >= int(settings.HOURLY_GLOBAL_LIMIT * 0.7):
            logger.warning(
                f"SUSPICIOUS global_hourly_approaching: {global_hour}/{settings.HOURLY_GLOBAL_LIMIT}"
            )
        if global_hour >= settings.HOURLY_GLOBAL_LIMIT:
            return {
                "blocked": True,
                "type": "global_hourly_limit",
                "message": "Worth the Watch is buzzing right now! Check back shortly.",
                "retry_after_seconds": 600,
            }

        # Per-IP burst (generation entries in last N minutes)
        burst_cutoff = now - timedelta(minutes=IP_ABUSE_WINDOW_MINUTES)
        ip_burst = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.ip_hash == ip_hash,
                RateLimitEntry.limit_type == "generation",
                RateLimitEntry.created_at > burst_cutoff,
            )
        )).scalar() or 0
        if ip_burst >= int(IP_ABUSE_THRESHOLD * 0.7):
            logger.warning(
                f"SUSPICIOUS ip_approaching_burst: ip_hash={ip_hash}, "
                f"count={ip_burst}/{IP_ABUSE_THRESHOLD}"
            )
        if ip_burst >= IP_ABUSE_THRESHOLD:
            return {
                "blocked": True,
                "type": "ip_abuse",
                "message": "Too many requests. Please try again shortly.",
                "retry_after_seconds": 300,
            }

        # Per-IP daily cap
        ip_day = (await db.execute(
            select(func.count()).select_from(RateLimitEntry).where(
                RateLimitEntry.ip_hash == ip_hash,
                RateLimitEntry.limit_type == "generation",
                RateLimitEntry.created_at > day_ago,
            )
        )).scalar() or 0
        if ip_day >= int(IP_DAILY_CAP * 0.7):
            logger.warning(
                f"SUSPICIOUS ip_approaching_daily: ip_hash={ip_hash}, "
                f"count={ip_day}/{IP_DAILY_CAP}"
            )
        if ip_day >= IP_DAILY_CAP:
            return {
                "blocked": True,
                "type": "ip_daily_limit",
                "message": "Daily limit reached for this network. Try again tomorrow.",
                "retry_after_seconds": 3600,
            }

    return {"blocked": False}


async def cleanup_old_rate_limit_entries():
    """Delete rate limit entries older than 48 hours. Call from cron."""
    cutoff = datetime.utcnow() - timedelta(hours=48)
    async with async_session() as db:
        await db.execute(
            delete(RateLimitEntry).where(RateLimitEntry.created_at < cutoff)
        )
        await db.commit()
