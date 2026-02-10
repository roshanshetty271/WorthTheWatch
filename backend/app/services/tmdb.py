"""
Worth the Watch? — TMDB API Service
Handles movie metadata, trending, upcoming, search, and watch providers.
Free API, ~50 req/sec, no daily limit.
"""

import re
import httpx
import asyncio
import logging
from datetime import date
from typing import Optional
from app.config import get_settings
from app.services.safety import is_safe_content
from rapidfuzz import process, fuzz

settings = get_settings()
logger = logging.getLogger(__name__)

TMDB_HEADERS = {
    "Authorization": f"Bearer {settings.TMDB_API_KEY}",
    "accept": "application/json",
}


class TMDBService:
    def __init__(self):
        self.base = settings.TMDB_BASE_URL
        self.image_base = settings.TMDB_IMAGE_BASE
        # Cache for "Did you mean?" fuzzy search
        # Stores tuples of (title, popularity)
        self.popular_titles_cache: list[tuple[str, float]] = []
        self._cache_lock = asyncio.Lock()

    async def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make TMDB API request with error handling and retry."""
        max_retries = 2
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    resp = await client.get(
                        f"{self.base}{endpoint}",
                        headers=TMDB_HEADERS,
                        params=params or {},
                    )
                    
                    if resp.status_code == 401:
                        logger.critical("⚠️ TMDB API key is invalid!")
                        return {}
                    
                    if resp.status_code == 404:
                        logger.debug(f"TMDB 404: {endpoint}")
                        return {}
                    
                    if resp.status_code == 429:
                        logger.warning("TMDB rate limited, waiting 1s...")
                        await asyncio.sleep(1)
                        continue
                    
                    if resp.status_code >= 500:
                        if attempt < max_retries - 1:
                            await asyncio.sleep(1)
                            continue
                        logger.error(f"TMDB server error: {resp.status_code}")
                        return {}
                    
                    resp.raise_for_status()
                    return resp.json()
                    
            except httpx.TimeoutException:
                logger.warning(f"TMDB timeout: {endpoint}")
                if attempt < max_retries - 1:
                    continue
                return {}
            except Exception as e:
                logger.error(f"TMDB request failed: {e}")
                return {}
        
        return {}

    def _filter_results(self, items: list[dict]) -> list[dict]:
        """Filter out adult/porn content and spam."""
        filtered = []
        for item in items:
            # Skip items without a title
            if not (item.get("title") or item.get("name")):
                continue
                
            # Use upgraded safety check from dedicated service
            if not is_safe_content(item):
                continue
                
            filtered.append(item)
        return filtered

    async def get_trending(self, media_type: str = "all", time_window: str = "day", page: int = 1) -> list[dict]:
        """Get trending movies/tv. media_type: 'all', 'movie', 'tv'"""
        data = await self._get(f"/trending/{media_type}/{time_window}", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_now_playing(self, page: int = 1) -> list[dict]:
        """Movies currently in theaters."""
        data = await self._get("/movie/now_playing", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_upcoming(self, page: int = 1) -> list[dict]:
        """Movies coming soon — for pre-computation."""
        data = await self._get("/movie/upcoming", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_popular_tv(self, page: int = 1) -> list[dict]:
        """Popular TV shows."""
        data = await self._get("/tv/popular", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_top_rated_movies(self, page: int = 1) -> list[dict]:
        """Highest rated movies on TMDB."""
        data = await self._get("/movie/top_rated", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_top_rated_tv(self, page: int = 1) -> list[dict]:
        """Highest rated TV shows on TMDB."""
        data = await self._get("/tv/top_rated", {
            "page": page,
            "include_adult": "false"
        })
        return self._filter_results(data.get("results", []))

    async def get_movie_details(self, tmdb_id: int) -> dict:
        """Full movie details."""
        return await self._get(f"/movie/{tmdb_id}")

    async def get_tv_details(self, tmdb_id: int) -> dict:
        """Full TV show details."""
        return await self._get(f"/tv/{tmdb_id}")

    async def search(self, query: str, page: int = 1) -> list[dict]:
        """
        Multi-search with smart year detection.
        
        Supports:
        - "Iron Man" → general multi-search
        - "The Call 2020" → year-filtered search
        - "The Call (2020)" → year-filtered search
        """
        query = query.strip()
        
        # Smart year detection — check for trailing year like "2020" or "(2020)"
        year_match = re.search(r'\s*\(?((?:19|20)\d{2})\)?$', query)
        
        if year_match:
            year = int(year_match.group(1))
            clean_query = re.sub(r'\s*\(?((?:19|20)\d{2})\)?$', '', query).strip()
            
            if clean_query:
                # Year detected — use specific endpoints with year filter for better accuracy
                movie_results, tv_results = await asyncio.gather(
                    self._search_movies(clean_query, year, page),
                    self._search_tv(clean_query, year, page),
                    return_exceptions=True,
                )
                
                results = []
                if isinstance(movie_results, list):
                    results.extend(movie_results)
                if isinstance(tv_results, list):
                    results.extend(tv_results)
                
                if results:
                    return self._filter_results(results)
                # Fall through to general search if year-specific search found nothing
        
        # General multi-search (no year detected, or year search found nothing)
        data = await self._get("/search/multi", {
            "query": query,
            "page": page,
            "include_adult": "false",
        })
        results = data.get("results", [])
        results = [r for r in results if r.get("media_type") in ("movie", "tv")]
        filtered = self._filter_results(results)
        # Sort by Significance (Vote Count) to prioritize blockbusters
        # "The Martian" (high votes) should beat "Martin" (low votes) even if "Martin" is a closer string match
        
        high_tier = []
        low_tier = []
        
        for item in filtered:
            # Penalize obscure titles with < 100 votes
            if item.get("vote_count", 0) < 100:
                low_tier.append(item)
            else:
                high_tier.append(item)
        
        # Sort both tiers by Vote Count DESC (primary) and Popularity DESC (secondary)
        high_tier.sort(key=lambda x: (x.get("vote_count", 0), x.get("popularity", 0)), reverse=True)
        low_tier.sort(key=lambda x: (x.get("vote_count", 0), x.get("popularity", 0)), reverse=True)
        
        return high_tier + low_tier

    async def _search_movies(self, query: str, year: int, page: int = 1) -> list[dict]:
        """Search movies with year filter."""
        data = await self._get("/search/movie", {
            "query": query,
            "page": page,
            "primary_release_year": year,
            "include_adult": "false",
        })
        results = data.get("results", [])
        # Add media_type since /search/movie doesn't include it
        for r in results:
            r["media_type"] = "movie"
        return results

    async def _search_tv(self, query: str, year: int, page: int = 1) -> list[dict]:
        """Search TV shows with year filter."""
        data = await self._get("/search/tv", {
            "query": query,
            "page": page,
            "first_air_date_year": year,
            "include_adult": "false",
        })
        results = data.get("results", [])
        # Add media_type since /search/tv doesn't include it
        for r in results:
            r["media_type"] = "tv"
        return results

    async def get_watch_providers(self, tmdb_id: int, media_type: str = "movie", region: str = "US") -> dict:
        """
        Get streaming/rent/buy availability from TMDB (JustWatch data).
        FREE - no extra API needed!
        
        Returns:
            {
                "flatrate": [{"provider_name": "Netflix", "logo_path": "...", "provider_id": 8}],
                "rent": [...],
                "buy": [...],
                "free": [...],
                "link": "https://www.themoviedb.org/movie/123/watch"
            }
        """
        endpoint = f"/{media_type}/{tmdb_id}/watch/providers"
        try:
            data = await self._get(endpoint)
            results = data.get("results", {})
            
            # Get region-specific data (default US)
            region_data = results.get(region, results.get("US", {}))
            
            return {
                "flatrate": region_data.get("flatrate", []),  # Subscription (Netflix, etc)
                "rent": region_data.get("rent", []),          # Rent options
                "buy": region_data.get("buy", []),            # Purchase options
                "free": region_data.get("free", []),          # Free with ads (Tubi, etc)
                "ads": region_data.get("ads", []),            # Free with ads
                "link": region_data.get("link", ""),          # JustWatch link
            }
        except Exception:
            return {"flatrate": [], "rent": [], "buy": [], "free": [], "ads": [], "link": ""}

    async def get_videos(self, tmdb_id: int, media_type: str = "movie") -> list[dict]:
        """
        Get videos (trailers, teasers, clips) from TMDB.
        Returns list of video objects, sorted by type (Trailer first).
        """
        endpoint = f"/{media_type}/{tmdb_id}/videos"
        data = await self._get(endpoint)
        results = data.get("results", [])
        
        # Filter for YouTube only
        videos = [v for v in results if v.get("site") == "YouTube"]
        
        # Sort priority: Trailer > Teaser > Clip > Featurette
        type_priority = {"Trailer": 0, "Teaser": 1, "Clip": 2, "Featurette": 3}
        videos.sort(key=lambda x: type_priority.get(x.get("type"), 99))
        
        return videos

    def get_poster_url(self, path: Optional[str], size: str = "w500") -> Optional[str]:
        if not path:
            return None
        return f"{self.image_base}/{size}{path}"

    def get_backdrop_url(self, path: Optional[str], size: str = "w1280") -> Optional[str]:
        if not path:
            return None
        return f"{self.image_base}/{size}{path}"

    def normalize_result(self, item: dict) -> dict:
        """Normalize TMDB result to our schema."""
        media_type = item.get("media_type", "movie")
        title = item.get("title") or item.get("name", "Unknown")
        release = item.get("release_date") or item.get("first_air_date")
        poster_path = item.get("poster_path")
        backdrop_path = item.get("backdrop_path")

        return {
            "tmdb_id": item["id"],
            "title": title,
            "original_title": item.get("original_title") or item.get("original_name"),
            "media_type": media_type,
            "overview": item.get("overview"),
            "poster_path": poster_path,
            "backdrop_path": backdrop_path,
            "poster_url": self.get_poster_url(poster_path),
            "backdrop_url": self.get_backdrop_url(backdrop_path),
            "genres": item.get("genres") or [
                {"id": gid} for gid in (item.get("genre_ids") or [])
            ],
            "release_date": release,
            "tmdb_popularity": item.get("popularity"),
            "tmdb_vote_average": item.get("vote_average"),
            "tmdb_vote_count": item.get("vote_count"),
        }


    async def refresh_popular_cache(self):
        """
        Background task: Fetch top ~2000 popular movies to support fuzzy search.
        Runs once on startup (or periodically).
        """
        if self.popular_titles_cache:
            return  # Already populated

        logger.info("🎬 Warming up fuzzy search cache with popular movies...")
        try:
            # Fetch generic popular + top rated to get a good mix of blockbusters
            # We'll fetch 50 pages of each (approx 2000 items total) to keep it fast but useful
            tasks = []
            for page in range(1, 51):
                tasks.append(self.get_trending(media_type="movie", time_window="week", page=page))
                tasks.append(self.get_top_rated_movies(page=page))
            
            # Execute in batches to be nice to API
            batch_size = 10
            all_results = []
            for i in range(0, len(tasks), batch_size):
                batch = tasks[i:i+batch_size]
                results = await asyncio.gather(*batch, return_exceptions=True)
                for res in results:
                    if isinstance(res, list):
                        all_results.extend(res)
                await asyncio.sleep(0.2)  # tiny pause
            
            # Deduplicate by ID and store (title, popularity)
            unique_movies = {}
            for m in all_results:
                if m.get("id") and m.get("title"):
                    unique_movies[m["id"]] = (m["title"], m.get("popularity", 0))
            
            async with self._cache_lock:
                self.popular_titles_cache = list(unique_movies.values())
            
            logger.info(f"✅ Fuzzy cache warmed: {len(self.popular_titles_cache)} titles ready.")
            
        except Exception as e:
            logger.error(f"❌ Failed to warm up fuzzy cache: {e}")

    async def fuzzy_search(self, query: str) -> Optional[dict]:
        """
        Find a close match for a typo'd query using popular movie cache.
        Returns: {"suggestion": "Correct Title", "results": [TMDB_Objects...]} or None
        """
        if not self.popular_titles_cache or len(query) < 3:
            return None

        # valid matches must be at least 80% similar
        # extractOne returns (match, score, index)
        # We search against just the titles
        titles = [t[0] for t in self.popular_titles_cache]
        match = process.extractOne(query, titles, scorer=fuzz.ratio)
        
        if match:
            best_title, score, idx = match
            if score >= 80:
                logger.info(f"🔍 Fuzzy match found: '{query}' -> '{best_title}' ({score}%)")
                # Perform a real search for the corrected title
                results = await self.search(best_title)
                return {
                    "suggestion": best_title,
                    "results": results,
                    "score": score
                }
        
        return None


tmdb_service = TMDBService()
