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
    For short titles (<=3 words), use specific strict matching to avoid false positives.
    """
    title_lower = title.lower().strip()
    text_lower = text.lower().strip()
    
    title_words = title_lower.split()
    
    if len(title_words) <= 3:
        # Short title: require exact match with word boundaries and specific following context
        # "the call" should match "the call review", "the call (2013)"
        # but NOT "the call of the wild"
        
        safe_title = re.escape(title_lower)
        # Pattern: \bTITLE\b followed by (punctuation/year/review-words/end-of-string)
        # We also allow it if it's at the VERY END of the string
        pattern = rf'\b{safe_title}\b(?:\s*[\(\[\-–:]|\s*{year}|\s*review|\s*film|\s*movie|\s*$)'
        
        return bool(re.search(pattern, text_lower))
    else:
        # Longer title: simple word boundary check is usually enough
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
