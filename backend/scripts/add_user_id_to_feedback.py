"""
Add user_id column to review_feedback table.
Run: python -m scripts.add_user_id_to_feedback
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE review_feedback 
            ADD COLUMN IF NOT EXISTS user_id VARCHAR(255)
        """))
        print("Added user_id column to review_feedback")


if __name__ == "__main__":
    asyncio.run(migrate())
