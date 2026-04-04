"""
Worth the Watch? — Watchmode API Service
Fetches streaming deep links (Netflix, Prime, Hulu, etc.) for movies and TV shows.
Free tier: 1000 requests/month.

v1: US-only, web_url only, flatrate+free only.
Lazy cache with 30-day inline refresh. Falls back to provider homepages when
direct deep links are unavailable.
"""

import httpx
import logging
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote

from sqlalchemy import select, func, delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.database import async_session
from app.models import WatchmodeQuota, StreamingDeeplink, WatchmodeFetchState

settings = get_settings()
logger = logging.getLogger(__name__)


# ─── Watchmode name → TMDB provider_id map ─────────────────────
# Single direction. Match Watchmode response names to TMDB provider IDs.
WATCHMODE_TO_TMDB_PROVIDER = {
    "netflix": 8,
    "amazon prime video": 9,
    "prime video": 9,
    "amazon video": 10,
    "disney plus": 337,
    "hulu": 15,
    "hbo max": 1899,
    "max": 1899,
    "apple tv plus": 350,
    "apple tv": 2,
    "peacock": 386,
    "peacock premium": 386,
    "crunchyroll": 283,
    "paramount plus": 531,
    "google play movies": 3,
    "youtube": 192,
    "tubi": 73,
    "pluto tv": 300,
}

PROVIDER_FALLBACK_URLS = {
    2: "https://tv.apple.com/",
    3: "https://play.google.com/store/movies",
    8: "https://www.netflix.com/",
    9: "https://www.primevideo.com/",
    10: "https://www.amazon.com/gp/video/storefront/",
    15: "https://www.hulu.com/",
    73: "https://tubitv.com/",
    192: "https://www.youtube.com/movies",
    283: "https://www.crunchyroll.com/",
    300: "https://pluto.tv/",
    337: "https://www.disneyplus.com/",
    350: "https://tv.apple.com/",
    386: "https://www.peacocktv.com/",
    531: "https://www.paramountplus.com/",
    1899: "https://www.max.com/",
}

# Search URL templates — used when a movie title is available but no Watchmode
# deep link exists. {title} is replaced with the URL-encoded movie title.
PROVIDER_SEARCH_TEMPLATES = {
    2: "https://tv.apple.com/search?term={title}",
    3: "https://play.google.com/store/search?q={title}&c=movies",
    8: "https://www.netflix.com/search?q={title}",
    9: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={title}",
    10: "https://www.amazon.com/s?k={title}&i=instant-video",
    15: "https://www.hulu.com/search?q={title}",
    73: "https://tubitv.com/search/{title}",
    192: "https://www.youtube.com/results?search_query={title}",
    283: "https://www.crunchyroll.com/search?q={title}",
    300: "https://pluto.tv/search/details?query={title}",
    337: "https://www.disneyplus.com/search?q={title}",
    350: "https://tv.apple.com/search?term={title}",
    386: "https://www.peacocktv.com/search?q={title}",
    531: "https://www.paramountplus.com/search/?q={title}",
    1899: "https://www.max.com/search?q={title}",
}


def _normalize_provider_name(name: str) -> str:
    normalized = (name or "").lower().strip()
    normalized = normalized.replace("&", " and ").replace("+", " plus ")
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def _match_tmdb_provider_id(name: str) -> Optional[int]:
    normalized_name = _normalize_provider_name(name)
    if not normalized_name:
        return None

    direct_match = WATCHMODE_TO_TMDB_PROVIDER.get(normalized_name)
    if direct_match:
        return direct_match

    for alias, provider_id in WATCHMODE_TO_TMDB_PROVIDER.items():
        if (
            normalized_name.startswith(f"{alias} ")
            or normalized_name.endswith(f" {alias}")
            or f" {alias} " in normalized_name
        ):
            return provider_id

    return None


def get_provider_fallback_url(
    provider_id: Optional[int],
    provider_name: str = "",
    title: str = "",
) -> Optional[str]:
    # Resolve to a known provider ID (direct match first, then name-based)
    resolved_id = provider_id if (provider_id and provider_id in PROVIDER_FALLBACK_URLS) else None
    if not resolved_id:
        resolved_id = _match_tmdb_provider_id(provider_name)

    if not resolved_id:
        return None

    # If we have a title, return a search URL so users land on the right page
    # (and mobile universal links can trigger the native app)
    if title and resolved_id in PROVIDER_SEARCH_TEMPLATES:
        encoded = quote(title, safe="")
        return PROVIDER_SEARCH_TEMPLATES[resolved_id].replace("{title}", encoded)

    # No title — fall back to provider homepage
    return PROVIDER_FALLBACK_URLS.get(resolved_id)


# ─── Quota Tracking ─────────────────────────────────────────────

async def _check_watchmode_quota() -> bool:
    """Returns True if under 898 calls this calendar month (reserves 2 for next pair)."""
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    async with async_session() as db:
        count = (await db.execute(
            select(func.count()).select_from(WatchmodeQuota).where(
                WatchmodeQuota.created_at >= month_start,
            )
        )).scalar() or 0
    if count >= 800:
        logger.warning(f"⚠️ Watchmode quota approaching: {count}/900")
    return count < 898


async def _record_watchmode_call():
    """Record a single Watchmode API call. Called right before outbound HTTP request."""
    async with async_session() as db:
        db.add(WatchmodeQuota(created_at=datetime.utcnow()))
        await db.commit()


# ─── Watchmode API Methods (structured results) ────────────────

class StreamingSource:
    """Container for a streaming source."""
    def __init__(self, source_id, name, source_type, web_url=None, **kwargs):
        self.source_id = source_id
        self.name = name
        self.source_type = source_type
        self.web_url = web_url


class WatchmodeService:
    BASE_URL = "https://api.watchmode.com/v1"

    def __init__(self):
        self.api_key = getattr(settings, "WATCHMODE_API_KEY", "")

    async def get_title_id_by_tmdb(self, tmdb_id: int, media_type: str = "movie") -> dict:
        """
        Look up Watchmode title ID using TMDB ID.
        Returns {"ok": True, "title_id": int|None} or {"ok": False, "error": str}
        Does NOT fall back to first result if media_type doesn't match.
        """
        if not self.api_key:
            return {"ok": False, "error": "no_api_key"}

        wm_type = "tv_series" if media_type == "tv" else "movie"
        search_field = "tmdb_tv_id" if media_type == "tv" else "tmdb_movie_id"
        params = {"apiKey": self.api_key, "search_field": search_field, "search_value": str(tmdb_id)}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await _record_watchmode_call()
                resp = await client.get(f"{self.BASE_URL}/search/", params=params)
                resp.raise_for_status()
                data = resp.json()

            for result in data.get("title_results", []):
                if result.get("type") == wm_type:
                    return {"ok": True, "title_id": result.get("id")}

            # No type match — return None (not found), don't fall back to wrong type
            return {"ok": True, "title_id": None}

        except Exception as e:
            logger.warning(f"Watchmode lookup failed for tmdb_id={tmdb_id}: {e}")
            return {"ok": False, "error": str(e)}

    async def get_streaming_sources(self, title_id: int, region: str = "US") -> dict:
        """
        Get streaming sources for a Watchmode title ID.
        Returns {"ok": True, "sources": list} or {"ok": False, "error": str}
        """
        if not self.api_key:
            return {"ok": False, "error": "no_api_key"}

        params = {"apiKey": self.api_key, "regions": region}

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await _record_watchmode_call()
                resp = await client.get(
                    f"{self.BASE_URL}/title/{title_id}/sources/",
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            sources = []
            for item in data if isinstance(data, list) else []:
                sources.append(StreamingSource(
                    source_id=item.get("source_id", 0),
                    name=item.get("name", ""),
                    source_type=item.get("type", ""),
                    web_url=item.get("web_url"),
                ))
            return {"ok": True, "sources": sources}

        except Exception as e:
            logger.warning(f"Watchmode sources failed for title_id={title_id}: {e}")
            return {"ok": False, "error": str(e)}


# ─── Cache Logic ────────────────────────────────────────────────

async def _get_fetch_state(tmdb_id: int, media_type: str) -> Optional[dict]:
    async with async_session() as db:
        row = (await db.execute(
            select(WatchmodeFetchState).where(
                WatchmodeFetchState.tmdb_id == tmdb_id,
                WatchmodeFetchState.media_type == media_type,
            )
        )).scalar_one_or_none()
        if row:
            return {"fetched_at": row.fetched_at, "had_matches": row.had_matches}
    return None


async def _get_cached_deeplinks(tmdb_id: int, media_type: str) -> dict:
    """Returns {provider_id: web_url} from cache, or empty dict."""
    async with async_session() as db:
        rows = (await db.execute(
            select(StreamingDeeplink).where(
                StreamingDeeplink.tmdb_id == tmdb_id,
                StreamingDeeplink.media_type == media_type,
            )
        )).scalars().all()
    if rows:
        return {row.provider_id: row.web_url for row in rows if row.web_url}
    return {}


async def get_deeplinks_for_movie(tmdb_id: int, media_type: str) -> dict:
    """
    Returns {tmdb_provider_id: web_url} for this movie.
    Checks cache first, fetches from Watchmode if stale/missing.
    Only caches "sub" and "free" source types (v1 scope).
    """
    now = datetime.utcnow()

    # 1. Check fetch state (includes negative cache)
    fetch_state = await _get_fetch_state(tmdb_id, media_type)
    if fetch_state and fetch_state["fetched_at"] > (now - timedelta(days=30)):
        if not fetch_state["had_matches"]:
            return {}
        cached = await _get_cached_deeplinks(tmdb_id, media_type)
        if cached:
            return cached
        # had_matches=True but rows missing — fall through to refetch

    # 2. Check quota
    if not await _check_watchmode_quota():
        logger.info(f"⏸️ Watchmode quota exhausted, using fallback for tmdb_id={tmdb_id}")
        return await _get_cached_deeplinks(tmdb_id, media_type)

    # 3. Fetch from Watchmode
    wm = watchmode_service
    lookup = await wm.get_title_id_by_tmdb(tmdb_id, media_type)
    if not lookup["ok"]:
        # API failure — preserve existing cache
        return await _get_cached_deeplinks(tmdb_id, media_type)

    if lookup["title_id"] is None:
        sources = []
    else:
        result = await wm.get_streaming_sources(lookup["title_id"], region="US")
        if not result["ok"]:
            return await _get_cached_deeplinks(tmdb_id, media_type)
        sources = result["sources"]

    # 4. Build matched rows — dedupe by (provider_id, source_type)
    matched_rows = {}
    unmatched_sources = set()
    for source in sources:
        if source.source_type not in ("sub", "free"):
            continue
        if not source.web_url:
            continue

        tmdb_pid = _match_tmdb_provider_id(source.name)
        if not tmdb_pid:
            normalized_name = _normalize_provider_name(source.name)
            if normalized_name:
                unmatched_sources.add(normalized_name)
            continue

        key = (tmdb_pid, source.source_type)
        if key not in matched_rows:
            matched_rows[key] = {
                "provider_id": tmdb_pid,
                "provider_name": source.name,
                "source_type": source.source_type,
                "web_url": source.web_url,
            }

    if unmatched_sources:
        logger.info(
            "Watchmode unmatched providers for tmdb_id=%s (%s): %s",
            tmdb_id,
            media_type,
            ", ".join(sorted(unmatched_sources)),
        )

    # 5. Atomic transaction: delete old + insert fresh + upsert fetch state
    links = {}
    rows = list(matched_rows.values())
    async with async_session() as db:
        await db.execute(
            delete(StreamingDeeplink).where(
                StreamingDeeplink.tmdb_id == tmdb_id,
                StreamingDeeplink.media_type == media_type,
            )
        )
        for row in rows:
            links[row["provider_id"]] = row["web_url"]
            db.add(StreamingDeeplink(
                tmdb_id=tmdb_id,
                media_type=media_type,
                provider_id=row["provider_id"],
                provider_name=row["provider_name"],
                source_type=row["source_type"],
                web_url=row["web_url"],
                fetched_at=now,
            ))
        stmt = pg_insert(WatchmodeFetchState).values(
            tmdb_id=tmdb_id,
            media_type=media_type,
            fetched_at=now,
            had_matches=bool(rows),
        ).on_conflict_do_update(
            index_elements=["tmdb_id", "media_type"],
            set_={"fetched_at": now, "had_matches": bool(rows)},
        )
        await db.execute(stmt)
        await db.commit()

    logger.info(f"🔗 Watchmode cached {len(rows)} deeplinks for tmdb_id={tmdb_id} ({media_type})")
    return links


# Global service instance
watchmode_service = WatchmodeService()
