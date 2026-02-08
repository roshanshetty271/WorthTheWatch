"""
Worth the Watch? — Serper API Service
Searches Google for review articles and Reddit discussions.
Free tier: 2500 searches on signup.
"""

import httpx
from app.config import get_settings

settings = get_settings()


class SerperService:
    def __init__(self):
        self.url = "https://google.serper.dev/search"
        self.headers = {
            "X-API-KEY": settings.SERPER_API_KEY,
            "Content-Type": "application/json",
        }

    async def search(self, query: str, num_results: int = 10) -> list[dict]:
        """Search Google via Serper. Returns list of {title, link, snippet}."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                self.url,
                headers=self.headers,
                json={"q": query, "num": num_results},
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for item in data.get("organic", []):
            results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
            })
        return results

    async def search_reviews(self, title: str, year: str = "") -> list[dict]:
        """Search for critic review articles."""
        query = f'"{title}" {year} review'.strip()
        return await self.search(query, num_results=15)

    async def search_reddit(self, title: str, year: str = "") -> list[dict]:
        """Search Reddit discussions via Google."""
        query = f'"{title}" {year} site:reddit.com review discussion'.strip()
        return await self.search(query, num_results=10)


serper_service = SerperService()
