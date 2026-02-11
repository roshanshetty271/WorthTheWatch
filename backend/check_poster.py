
import asyncio
import sys
import os

# Adjust path to find app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session
from app.models import Movie
from sqlalchemy import select

async def check_movie():
    output = []
    async with async_session() as db:
        result = await db.execute(select(Movie).where(Movie.title.ilike("%Trap House%")))
        movies = result.scalars().all()
        
        output.append(f"Found {len(movies)} movies matching 'Trap House':")
        for m in movies:
            output.append("-" * 40)
            output.append(f"Title: {m.title}")
            output.append(f"TMDB ID: {m.tmdb_id}")
            output.append(f"Year: {m.release_date}")
            output.append(f"Poster Path (DB): '{m.poster_path}'")
            output.append(f"Backdrop Path (DB): '{m.backdrop_path}'")
            
            # Now fetch from TMDB to compare
            if m.tmdb_id:
                try:
                    from app.services.tmdb import tmdb_service
                    
                    output.append(f"Fetching TMDB ID {m.tmdb_id} from API...")
                    tmdb_data = await tmdb_service.get_movie_details(m.tmdb_id)
                    if tmdb_data:
                        output.append(f"Poster Path (API): '{tmdb_data.get('poster_path')}'")
                        output.append(f"Backdrop Path (API): '{tmdb_data.get('backdrop_path')}'")
                    else:
                        output.append("TMDB API returned no data.")
                except Exception as e:
                    output.append(f"Failed to fetch from TMDB: {e}")
            output.append("-" * 40)
            
    with open("poster_debug.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output))

if __name__ == "__main__":
    asyncio.run(check_movie())

