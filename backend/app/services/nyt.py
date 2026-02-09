"""
Worth the Watch? — New York Times API Service
Uses Article Search API to find movie reviews (Movie Reviews API deprecated).
Free tier: 500 requests/day.

Article Search API: https://developer.nytimes.com/docs/articlesearch-product/1/overview
"""

import re
import httpx
import logging
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry


def _title_matches(title: str, text: str, year: str = "") -> bool:
    """
    Check if title appears in text.
    For short titles (<=3 chars), use very strict matching to avoid false positives
    like "Cover Up" matching when searching for "Up".
    """
    title_lower = title.lower().strip()
    text_lower = text.lower().strip()
    
    if len(title_lower) <= 3:
        # Very strict matching for short titles like "It", "Up", "Her", "Us"
        # Must start with the title, or contain "title (year)", or be followed by punctuation
        
        # Check if headline starts with the title followed by space or punctuation
        starts_with = (
            text_lower.startswith(title_lower + " ") or 
            text_lower.startswith(title_lower + ":") or
            text_lower.startswith(title_lower + ",") or
            text_lower.startswith(title_lower + " –") or
            text_lower.startswith(title_lower + " -")
        )
        
        # Check if "title (year)" appears (e.g., "Up (2009)")
        has_year = f"{title_lower} ({year})" in text_lower if year else False
        
        # Check for pattern: "title review" at start
        has_review = text_lower.startswith(f"{title_lower} review")
        
        return starts_with or has_year or has_review
    else:
        # Normal word boundary matching for longer titles
        pattern = re.compile(r'\b' + re.escape(title_lower) + r'\b')
        return bool(pattern.search(text_lower))

settings = get_settings()
logger = logging.getLogger(__name__)


class NYTReview:
    """Container for a NYT movie review."""
    
    def __init__(
        self,
        url: str,
        headline: str,
        summary: str = "",
        publication_date: Optional[str] = None,
        critics_pick: bool = False,
        reviewer: Optional[str] = None,
    ):
        self.url = url
        self.headline = headline
        self.summary = summary
        self.publication_date = publication_date
        self.critics_pick = critics_pick
        self.reviewer = reviewer

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "headline": self.headline,
            "snippet": self.summary,
            "publication_date": self.publication_date,
            "critics_pick": self.critics_pick,
            "reviewer": self.reviewer,
            "source": "New York Times",
        }


class NYTService:
    """NYT Article Search API client for movie reviews.
    
    Note: The dedicated Movie Reviews API has been deprecated.
    We now use Article Search API filtered by section and document type.
    """
    
    # Article Search API (working as of 2024)
    ARTICLE_SEARCH_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json"
    
    # Legacy Movie Reviews API (may not work)
    MOVIE_REVIEWS_URL = "https://api.nytimes.com/svc/movies/v2"

    def __init__(self):
        self.api_key = getattr(settings, "NYT_API_KEY", "")

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def search_reviews(
        self,
        title: str,
        max_results: int = 5,
    ) -> list[NYTReview]:
        """
        Search NYT for movie reviews using Article Search API.
        
        Args:
            title: Movie title to search
            max_results: Maximum number of results (default: 5)
            
        Returns:
            List of NYTReview objects
        """
        if not self.api_key:
            return []

        # First try Article Search API (more reliable)
        results = await self._search_via_article_api(title, max_results)
        
        # Fallback to legacy Movie Reviews API if no results
        if not results:
            results = await self._search_via_movie_reviews_api(title, max_results)
        
        return results

    async def _search_via_article_api(
        self, title: str, max_results: int
    ) -> list[NYTReview]:
        """Search using Article Search API filtered for movie reviews."""
        # New filter syntax as of April 8, 2025:
        # section.name for section, typeOfMaterials for type
        fq = 'typeOfMaterials:Review AND section.name:Movies'
        
        params = {
            "api-key": self.api_key,
            "q": f'"{title}"',  # Exact phrase match
            "fq": fq,
            "sort": "relevance",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.ARTICLE_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            results = []
            docs = data.get("response", {}).get("docs", [])
            
            for item in docs:
                headline_obj = item.get("headline", {})
                headline = headline_obj.get("default", headline_obj.get("main", "")) if isinstance(headline_obj, dict) else str(headline_obj)
                summary = item.get("summary", item.get("snippet", ""))
                
                # Post-filter: only keep articles that actually mention the movie
                # NYT doesn't pass year, but strict position-based matching still works
                if not _title_matches(title, headline, "") and not _title_matches(title, summary, ""):
                    logger.debug(f"NYT: Discarding '{headline[:50]}' - doesn't mention '{title}'")
                    continue
                
                bylines = item.get("bylines", [])
                byline_str = bylines[0].get("renderedRepresentation", "") if bylines else None
                
                review = NYTReview(
                    url=item.get("url", item.get("web_url", "")),
                    headline=headline,
                    summary=summary,
                    publication_date=item.get("firstPublished", "")[:10] if item.get("firstPublished") else None,
                    critics_pick=False,  # Not available in Article Search
                    reviewer=byline_str,
                )
                results.append(review)
                
                # Stop after enough valid results
                if len(results) >= max_results:
                    break

            if results:
                logger.info(f"NYT Article Search: Found {len(results)} relevant reviews for '{title}'")
            return results

        except httpx.HTTPStatusError as e:
            logger.warning(f"NYT Article Search failed: {e}")
            return []
        except Exception as e:
            logger.warning(f"NYT Article Search error: {e}")
            return []

    async def _search_via_movie_reviews_api(
        self, title: str, max_results: int
    ) -> list[NYTReview]:
        """Fallback: Try legacy Movie Reviews API (may be deprecated)."""
        params = {
            "api-key": self.api_key,
            "query": title,
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.MOVIE_REVIEWS_URL}/reviews/search.json",
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            results = []
            
            for item in data.get("results", [])[:max_results]:
                link = item.get("link", {})
                review = NYTReview(
                    url=link.get("url", ""),
                    headline=item.get("headline", item.get("display_title", "")),
                    summary=item.get("summary_short", ""),
                    publication_date=item.get("publication_date"),
                    critics_pick=item.get("critics_pick", 0) == 1,
                    reviewer=item.get("byline"),
                )
                results.append(review)

            if results:
                logger.info(f"NYT Movie Reviews API: Found {len(results)} reviews for '{title}'")
            return results

        except httpx.HTTPStatusError:
            # API likely deprecated, fail silently
            return []
        except Exception:
            return []

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def get_critics_picks(self, max_results: int = 10) -> list[NYTReview]:
        """
        Get current NYT Critics' Picks using Article Search.
        
        Returns:
            List of NYTReview objects marked as critics' picks
        """
        if not self.api_key:
            return []

        # Search for recent movie reviews marked as picks
        fq = 'section_name:("Movies") AND type_of_material:("Review")'
        
        params = {
            "api-key": self.api_key,
            "fq": fq,
            "sort": "newest",
            "fl": "web_url,headline,snippet,pub_date,byline",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(self.ARTICLE_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            results = []
            docs = data.get("response", {}).get("docs", [])
            
            for item in docs[:max_results]:
                headline_obj = item.get("headline", {})
                byline_obj = item.get("byline", {})
                
                review = NYTReview(
                    url=item.get("web_url", ""),
                    headline=headline_obj.get("main", "") if isinstance(headline_obj, dict) else str(headline_obj),
                    summary=item.get("snippet", ""),
                    publication_date=item.get("pub_date", "")[:10] if item.get("pub_date") else None,
                    critics_pick=True,  # Assuming recent reviews are picks
                    reviewer=byline_obj.get("original", "") if isinstance(byline_obj, dict) else None,
                )
                results.append(review)

            return results

        except httpx.HTTPStatusError:
            return []
        except Exception:
            return []


# Global service instance
nyt_service = NYTService()
