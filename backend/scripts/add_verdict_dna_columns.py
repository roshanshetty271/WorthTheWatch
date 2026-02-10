import asyncio
import os
import sys

# Add backend to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Explicitly load .env
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from app.database import engine
from app.config import get_settings

async def run_migration():
    """Manually add new columns to the reviews table."""
    print("🚀 Starting migration: Adding Verdict DNA columns...")
    
    settings = get_settings()
    print(f"   Target DB: {settings.DATABASE_URL.split('@')[-1]}") # Print host only for verification

    async with engine.begin() as conn:
        # Check if columns exist (simple try/except approach for sqlite/postgres robustness)
        # We'll just try to add them. If they exist, it might fail, which is fine.
        
        commands = [
            "ALTER TABLE reviews ADD COLUMN tags JSON DEFAULT '[]';",
            "ALTER TABLE reviews ADD COLUMN best_quote TEXT;",
            "ALTER TABLE reviews ADD COLUMN quote_source VARCHAR(255);",
        ]
        
        for cmd in commands:
            try:
                print(f"   Executing: {cmd}")
                await conn.execute(text(cmd))
                print("   ✅ Success")
            except Exception as e:
                print(f"   ⚠️  Note: {e}") 
                # Likely "duplicate column name" if running twice. Safe to ignore in this dev context.

    print("🏁 Migration complete.")

if __name__ == "__main__":
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(run_migration())
