import asyncio
from sqlalchemy import text
from app.database import async_session

async def add_columns():
    """Add new columns for Review Voice and Critics vs Reddit features."""
    columns = [
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS hook TEXT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS who_should_watch TEXT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS who_should_skip TEXT;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS critic_sentiment VARCHAR(20);",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reddit_sentiment VARCHAR(20);",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS critics_agree_with_reddit BOOLEAN;",
        "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tension_point TEXT;"
    ]

    async with async_session() as session:
        print("🚀 Starting migration...")
        for col_sql in columns:
            try:
                print(f"Executing: {col_sql}")
                await session.execute(text(col_sql))
                await session.commit()
            except Exception as e:
                print(f"⚠️ Error (might already exist): {e}")
                await session.rollback()
        
        print("✅ Migration complete!")

if __name__ == "__main__":
    asyncio.run(add_columns())
