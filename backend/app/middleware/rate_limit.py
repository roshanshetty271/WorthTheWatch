"""
Worth the Watch? — Rate Limiting Middleware
Simple in-memory rate limiter. Fine for single-instance Koyeb deployment.
"""

import time
from collections import defaultdict
from fastapi import Request, HTTPException
from app.config import get_settings

settings = get_settings()

# In-memory store: {ip: [(timestamp, count)]}
_rate_store: dict[str, list[float]] = defaultdict(list)
_daily_generation_count = 0
_daily_reset_time = time.time()


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _cleanup_old_entries(entries: list[float], window_seconds: int) -> list[float]:
    cutoff = time.time() - window_seconds
    return [t for t in entries if t > cutoff]


async def check_rate_limit(request: Request, is_generation: bool = False):
    """Check rate limits. Raises 429 if exceeded."""
    global _daily_generation_count, _daily_reset_time

    # Reset daily counter
    if time.time() - _daily_reset_time > 86400:
        _daily_generation_count = 0
        _daily_reset_time = time.time()

    # Global daily generation limit
    if is_generation:
        if _daily_generation_count >= settings.DAILY_GENERATION_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Daily generation limit reached. Try again tomorrow."
            )

    ip = _get_client_ip(request)
    key_hour = f"{ip}:hour"
    key_day = f"{ip}:day"

    # Per-IP hourly limit
    _rate_store[key_hour] = _cleanup_old_entries(_rate_store[key_hour], 3600)
    if len(_rate_store[key_hour]) >= settings.ON_DEMAND_PER_IP_PER_HOUR:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Max 10 requests per hour."
        )

    # Per-IP daily limit
    _rate_store[key_day] = _cleanup_old_entries(_rate_store[key_day], 86400)
    if len(_rate_store[key_day]) >= settings.ON_DEMAND_PER_IP_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="Daily rate limit exceeded. Max 30 requests per day."
        )

    # Record this request
    now = time.time()
    _rate_store[key_hour].append(now)
    _rate_store[key_day].append(now)

    if is_generation:
        _daily_generation_count += 1
