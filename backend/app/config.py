"""
Worth the Watch? — Application Configuration
Uses pydantic-settings for type-safe environment variable management.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # App
    APP_NAME: str = "Worth the Watch?"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://worththewatch.vercel.app"

    # Database (Neon PostgreSQL)
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@localhost/worththewatch"

    # TMDB
    TMDB_API_KEY: str = ""
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE: str = "https://image.tmdb.org/t/p"

    # Serper (Google Search)
    SERPER_API_KEY: str = ""

    # Jina Reader
    JINA_API_KEY: str = ""
    JINA_BASE_URL: str = "https://r.jina.ai"

    # LLM (swappable)
    LLM_PROVIDER: str = "deepseek"  # "deepseek" or "openai"
    DEEPSEEK_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # Rate Limiting
    DAILY_GENERATION_LIMIT: int = 200
    ON_DEMAND_PER_IP_PER_HOUR: int = 10
    ON_DEMAND_PER_IP_PER_DAY: int = 30

    # Cron
    CRON_SECRET: str = "change-me-in-production"

    # Security
    IP_HASH_SALT: str = "change-me-in-production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
