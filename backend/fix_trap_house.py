
import asyncio
import sys
import os
from sqlalchemy import select, update

# Adjust path to find app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session
from app.models import Movie
from app.services.serper import serper_service

async def fix_trap_house():
    print("🔧 Fixing 'Trap House' poster...")
    
    async with async_session() as db:
        # 1. Find the movie
        result = await db.execute(select(Movie).where(Movie.title.ilike("%Trap House%")))
        movie = result.scalars().first()
        
        if not movie:
            print("❌ Movie 'Trap House' not found in DB.")
            return

        print(f"   Found movie: {movie.title} (ID: {movie.id})")
        print(f"   Current Poster: {movie.poster_path}")

        # 2. Fetch new poster via Serper
        print("   Fetching from Serper...")
        images = await serper_service.search_images(f"{movie.title} 2024 movie poster", num_results=3)
        
        if images:
            new_poster = images[0].get("imageUrl")
            print(f"   ✅ Found new poster: {new_poster}")
            
            # 3. Update DB
            movie.poster_path = new_poster
            await db.commit()
            print("   💾 Database updated successfully.")
        else:
            print("   ❌ Serper found no images.")

if __name__ == "__main__":
    asyncio.run(fix_trap_house())
