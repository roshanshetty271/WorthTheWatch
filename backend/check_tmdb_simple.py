
import asyncio
import sys
import os
import httpx
from dotenv import load_dotenv

# Adjust path to find app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load env explicitly
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(env_path)

from app.config import get_settings

async def fetch_tmdb():
    settings = get_settings()
    api_key = settings.TMDB_API_KEY
    tmdb_id = 1609893
    
    url = f"https://api.themoviedb.org/3/movie/{tmdb_id}"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "accept": "application/json"
    }
    
    print(f"Fetching {url} with Bearer token...")
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            output = []
            output.append(f"Title: {data.get('title')}")
            output.append(f"Poster: {data.get('poster_path')}")
            output.append(f"Backdrop: {data.get('backdrop_path')}")
            output.append(f"Release Date: {data.get('release_date')}")
            output.append(f"Status: {data.get('status')}")
            
            with open("poster_debug_simple.txt", "w") as f:
                f.write("\n".join(output))
        else:
            with open("poster_debug_simple.txt", "w") as f:
                f.write(f"Error: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    asyncio.run(fetch_tmdb())
