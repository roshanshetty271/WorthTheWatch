
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

async def check_sources():
    output = []
    settings = get_settings()
    movie_title = "Trap House"
    year = "2024" 
    
    output.append(f"🔎 Investigation: Finding poster for '{movie_title}' ({year})")
    output.append("-" * 50)

    # 1. OMDB
    omdb_key = settings.OMDB_API_KEY
    if omdb_key:
        output.append("1. Checking OMDB...")
        try:
            url = f"http://www.omdbapi.com/?t={movie_title}&y={year}&apikey={omdb_key}"
            async with httpx.AsyncClient() as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    poster = data.get("Poster")
                    if poster and poster != "N/A":
                        output.append(f"   ✅ Found Poster: {poster}")
                        output.append(f"   Title identified: {data.get('Title')} ({data.get('Year')})")
                    else:
                        output.append("   ❌ No poster found in OMDB.")
                        output.append(f"   Response: {data}")
                else:
                    output.append(f"   ❌ OMDB Error: {resp.status_code}")
        except Exception as e:
            output.append(f"   ❌ OMDB Failed: {e}")
    else:
        output.append("   ⚠️ No OMDB API Key found.")
        
    output.append("-" * 50)

    # 2. Serper (Google Images)
    serper_key = settings.SERPER_API_KEY
    if serper_key:
        output.append("2. Checking Serper (Google Images)...")
        try:
            url = "https://google.serper.dev/images"
            payload = {
                "q": f"{movie_title} {year} movie poster high resolution",
                "num": 3
            }
            headers = {
                "X-API-KEY": serper_key,
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    images = data.get("images", [])
                    if images:
                        output.append(f"   ✅ Found {len(images)} images via Serper.")
                        for i, img in enumerate(images[:2]):
                            output.append(f"   Image {i+1}: {img.get('imageUrl')}")
                            output.append(f"   Source: {img.get('source')} - {img.get('title')}")
                            output.append(f"   Dimensions: {img.get('width')}x{img.get('height')}")
                    else:
                        output.append("   ❌ No images found via Serper.")
                else:
                    output.append(f"   ❌ Serper Error: {resp.status_code}")
        except Exception as e:
            output.append(f"   ❌ Serper Failed: {e}")
    else:
        output.append("   ⚠️ No Serper API Key found.")

    output.append("-" * 50)
    
    with open("alternative_posters_debug.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    asyncio.run(check_sources())
