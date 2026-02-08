"""
Worth the Watch? — Review Freshness Service
Determines if a cached review is still fresh or needs regeneration.
Uses time-based TTL based on movie release date.
"""

from datetime import datetime, timedelta
from typing import Optional


def calculate_review_ttl_hours(release_date: Optional[str]) -> int:
    """
    Calculate the TTL (time-to-live) in hours based on release date.
    
    Fresher releases get shorter TTLs to capture evolving opinions.
    Older releases are considered stable and get longer TTLs.
    
    Args:
        release_date: ISO date string (YYYY-MM-DD) or None
        
    Returns:
        TTL in hours
    """
    if not release_date:
        # Unknown release date: short TTL to be safe
        return 48
    
    try:
        release = datetime.strptime(release_date[:10], "%Y-%m-%d")
    except (ValueError, TypeError):
        return 48
    
    now = datetime.now()
    days_since_release = (now - release).days
    
    if days_since_release < 0:
        # Upcoming release: very short TTL (opinions evolve quickly pre-release)
        return 6
    elif days_since_release <= 7:
        # First week: opinions are still forming, check frequently
        return 12
    elif days_since_release <= 30:
        # First month: settling down
        return 48
    elif days_since_release <= 90:
        # First 3 months: mostly stable
        return 168  # 1 week
    else:
        # After 3 months: review is stable, very long TTL
        return 720  # 30 days


def is_review_fresh(
    generated_at: Optional[str],
    release_date: Optional[str],
) -> bool:
    """
    Check if a review is still fresh based on its generation time and movie release date.
    
    Args:
        generated_at: ISO datetime string when the review was generated
        release_date: ISO date string of movie release
        
    Returns:
        True if review is still fresh, False if it should be regenerated
    """
    if not generated_at:
        return False
    
    try:
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        # Remove timezone info for comparison
        if generated.tzinfo:
            generated = generated.replace(tzinfo=None)
    except (ValueError, TypeError):
        return False
    
    ttl_hours = calculate_review_ttl_hours(release_date)
    age = datetime.now() - generated
    
    return age < timedelta(hours=ttl_hours)


def should_refresh_review(
    generated_at: Optional[str],
    release_date: Optional[str],
    force: bool = False,
) -> bool:
    """
    Determine if a review should be refreshed.
    
    Args:
        generated_at: ISO datetime string when the review was generated
        release_date: ISO date string of movie release
        force: Force refresh even if review is fresh
        
    Returns:
        True if review should be refreshed
    """
    if force:
        return True
    
    return not is_review_fresh(generated_at, release_date)


def get_freshness_info(
    generated_at: Optional[str],
    release_date: Optional[str],
) -> dict:
    """
    Get detailed freshness information for debugging/display.
    
    Returns:
        Dict with freshness details
    """
    if not generated_at:
        return {
            "is_fresh": False,
            "ttl_hours": 0,
            "age_hours": None,
            "expires_in_hours": None,
        }
    
    try:
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        if generated.tzinfo:
            generated = generated.replace(tzinfo=None)
    except (ValueError, TypeError):
        return {
            "is_fresh": False,
            "ttl_hours": 0,
            "age_hours": None,
            "expires_in_hours": None,
        }
    
    ttl_hours = calculate_review_ttl_hours(release_date)
    age = datetime.now() - generated
    age_hours = age.total_seconds() / 3600
    expires_in_hours = max(0, ttl_hours - age_hours)
    
    return {
        "is_fresh": age < timedelta(hours=ttl_hours),
        "ttl_hours": ttl_hours,
        "age_hours": round(age_hours, 1),
        "expires_in_hours": round(expires_in_hours, 1),
    }
