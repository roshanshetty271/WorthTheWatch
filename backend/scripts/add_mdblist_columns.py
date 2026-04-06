import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

from sqlalchemy import text

from app.database import engine
from app.config import get_settings


async def run_migration():
    """Add MDBList-backed review columns without disturbing existing data."""
    print("Starting migration: adding MDBList review columns...")

    settings = get_settings()
    print(f"Target DB: {settings.DATABASE_URL.split('@')[-1]}")

    commands = [
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS letterboxd_score FLOAT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS trakt_score INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS metacritic_user_score FLOAT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS mdblist_score INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rogerebert_score FLOAT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS age_rating INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content_violence INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content_nudity INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content_language INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content_drinking INTEGER;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS budget BIGINT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS revenue BIGINT;",
    ]

    async with engine.begin() as conn:
        for cmd in commands:
            try:
                print(f"Executing: {cmd}")
                await conn.execute(text(cmd))
                print("Success")
            except Exception as exc:
                print(f"Note: {exc}")

    print("Migration complete.")


if __name__ == "__main__":
    if os.name == "nt":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_migration())
