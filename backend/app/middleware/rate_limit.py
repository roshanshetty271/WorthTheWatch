"""
Worth the Watch? — Rate Limiting Middleware
Simple in-memory rate limiter. Fine for single-instance Koyeb deployment.
Supports per-type limits (generation, battle, roulette) and global hourly cap.
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException
from app.config import get_settings

settings = get_settings()

_rate_store: dict[str, list[float]] = defaultdict(list)
_global_hourly_store: list[float] = []
_daily_generation_count = 0
_daily_reset_time = time.time()

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
    """
    Get client IP address.
    Uses LEFTMOST IP from X-Forwarded-For (actual client, not proxy).
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",")]
        return ips[0] if ips else "unknown"
    return request.client.host if request.client else "unknown"


def _cleanup_old_entries(entries: list[float], window_seconds: int) -> list[float]:
    cutoff = time.time() - window_seconds
    return [t for t in entries if t > cutoff]


def _seconds_until_window_reset(entries: list[float], window_seconds: int) -> int:
    if not entries:
        return 0
    oldest_in_window = min(entries)
    reset_at = oldest_in_window + window_seconds
    return max(1, int(reset_at - time.time()))


async def check_rate_limit(request: Request, limit_type: str = "generation"):
    """Check rate limits by type. Raises 429 with structured JSON if exceeded."""
    global _daily_generation_count, _daily_reset_time, _global_hourly_store

    now = time.time()
    config = _LIMIT_MAP.get(limit_type, _LIMIT_MAP["generation"])

    # Reset daily generation counter
    if now - _daily_reset_time > 86400:
        _daily_generation_count = 0
        _daily_reset_time = now

    # Global daily generation limit (only for generation type)
    if config["counts_toward_daily_global"]:
        if _daily_generation_count >= settings.DAILY_GENERATION_LIMIT:
            raise HTTPException(
                status_code=429,
                detail={
                    "type": "global_daily_limit",
                    "message": "Our servers are at capacity for today. Try again tomorrow.",
                    "retry_after_seconds": _seconds_until_window_reset([_daily_reset_time], 86400),
                    "limit_type": limit_type,
                },
            )

    # Global hourly cap
    _global_hourly_store = _cleanup_old_entries(_global_hourly_store, 3600)
    if len(_global_hourly_store) >= settings.HOURLY_GLOBAL_LIMIT:
        retry_after = _seconds_until_window_reset(_global_hourly_store, 3600)
        raise HTTPException(
            status_code=429,
            detail={
                "type": "global_hourly_limit",
                "message": "Worth the Watch is buzzing right now! Check back shortly.",
                "retry_after_seconds": retry_after,
                "limit_type": limit_type,
            },
        )

    ip = _get_client_ip(request)
    key_hour = f"{ip}:{limit_type}:hour"
    key_day = f"{ip}:{limit_type}:day"

    # Per-IP hourly limit
    _rate_store[key_hour] = _cleanup_old_entries(_rate_store[key_hour], 3600)
    if len(_rate_store[key_hour]) >= config["per_ip_per_hour"]:
        retry_after = _seconds_until_window_reset(_rate_store[key_hour], 3600)
        raise HTTPException(
            status_code=429,
            detail={
                "type": "ip_hourly_limit",
                "message": f"Hourly limit reached. Try again in {retry_after // 60} minutes.",
                "retry_after_seconds": retry_after,
                "limit_type": limit_type,
            },
        )

    # Per-IP daily limit
    _rate_store[key_day] = _cleanup_old_entries(_rate_store[key_day], 86400)
    if len(_rate_store[key_day]) >= config["per_ip_per_day"]:
        retry_after = _seconds_until_window_reset(_rate_store[key_day], 86400)
        raise HTTPException(
            status_code=429,
            detail={
                "type": "ip_daily_limit",
                "message": "Daily limit reached. Try again tomorrow.",
                "retry_after_seconds": retry_after,
                "limit_type": limit_type,
            },
        )

    # Record this request
    _rate_store[key_hour].append(now)
    _rate_store[key_day].append(now)
    _global_hourly_store.append(now)

    if config["counts_toward_daily_global"]:
        _daily_generation_count += 1
