"""
Worth the Watch? — The Guardian API Service
Searches The Guardian for film reviews and critic opinions.
Free tier: Unlimited for non-commercial use.
"""

import re
import httpx
import logging
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()
logger = logging.getLogger(__name__)


class GuardianArticle:
    """Container for a Guardian article."""
    
    def __init__(
        self,
        url: str,
        headline: str,
        snippet: str = "",
        publication_date: Optional[str] = None,
    ):
        self.url = url
        self.headline = headline
        self.snippet = snippet
        self.publication_date = publication_date

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "headline": self.headline,
            "snippet": self.snippet,
            "publication_date": self.publication_date,
            "source": "The Guardian",
        }


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


class GuardianService:
    """The Guardian Open Platform API client."""
    
    BASE_URL = "https://content.guardianapis.com"

    def __init__(self):
        self.api_key = getattr(settings, "GUARDIAN_API_KEY", "")

    @with_retry(max_retries=2, base_delay=1.0, timeout=10.0)
    async def search_film_reviews(
        self,
        title: str,
        year: Optional[str] = None,
        max_results: int = 5,
    ) -> list[GuardianArticle]:
        """
        Search The Guardian for film reviews.
        
        Args:
            title: Movie or TV show title
            year: Optional release year for filtering
            max_results: Maximum number of results (default: 5)
            
        Returns:
            List of GuardianArticle objects
        """
        if not self.api_key:
            return []

        # Build search query - include year for better specificity
        query = f'"{title}"'
        if year:
            query += f" {year}"

        params = {
            "api-key": self.api_key,
            "q": query,
            "section": "film",
            "tag": "tone/reviews",
            "show-fields": "trailText,headline",
            "page-size": max_results * 2,  # Fetch more, then filter
            "order-by": "relevance",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search",
                    params=params,
                )
                
                # Handle API limit errors
                if resp.status_code in (401, 403, 429):
                    logger.warning("⚠️ Guardian API limit reached!")
                    return []
                
                if resp.status_code != 200:
                    logger.debug(f"Guardian returned {resp.status_code}")
                    return []
                    
                data = resp.json()

            results = []
            response = data.get("response", {})
            
            for item in response.get("results", []):
                fields = item.get("fields", {})
                headline = fields.get("headline", item.get("webTitle", ""))
                snippet = fields.get("trailText", "")
                
                # Post-filter: only keep articles that actually mention the movie
                if not _title_matches(title, headline, year or "") and not _title_matches(title, snippet, year or ""):
                    logger.debug(f"Guardian: Discarding '{headline[:50]}' - doesn't mention '{title}'")
                    continue
                
                article = GuardianArticle(
                    url=item.get("webUrl", ""),
                    headline=headline,
                    snippet=snippet,
                    publication_date=item.get("webPublicationDate"),
                )
                results.append(article)
                
                # Stop after enough valid results
                if len(results) >= max_results:
                    break

            if results:
                logger.info(f"Guardian: Found {len(results)} relevant reviews for '{title}'")
            return results

        except httpx.TimeoutException:
            logger.debug("Guardian API timed out")
            return []
        except httpx.HTTPStatusError:
            return []
        except Exception as e:
            logger.error(f"Guardian API failed: {e}")
            return []


# Global service instance
guardian_service = GuardianService()
