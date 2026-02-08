"""
Worth the Watch? — The Guardian API Service
Searches The Guardian for film reviews and critic opinions.
Free tier: Unlimited for non-commercial use.
"""

import httpx
from typing import Optional
from app.config import get_settings
from app.services.retry import with_retry

settings = get_settings()


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

        # Build search query
        query = f'"{title}"'
        if year:
            query += f" {year}"


        params = {
            "api-key": self.api_key,
            "q": query,
            "section": "film",
            "tag": "tone/reviews",
            "show-fields": "trailText,headline",
            "page-size": max_results,
            "order-by": "relevance",
        }

        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{self.BASE_URL}/search",
                    params=params,
                )
                resp.raise_for_status()
                data = resp.json()

            results = []
            response = data.get("response", {})
            
            for item in response.get("results", []):
                fields = item.get("fields", {})
                article = GuardianArticle(
                    url=item.get("webUrl", ""),
                    headline=fields.get("headline", item.get("webTitle", "")),
                    snippet=fields.get("trailText", ""),
                    publication_date=item.get("webPublicationDate"),
                )
                results.append(article)

            return results

        except httpx.HTTPStatusError:
            return []
        except Exception:
            return []


# Global service instance
guardian_service = GuardianService()
