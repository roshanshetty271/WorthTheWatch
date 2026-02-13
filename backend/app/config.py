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
    ENVIRONMENT: str = "development"  # "development" or "production"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:3000,https://worth-the-watch.vercel.app"

    # Database (Neon PostgreSQL)
    # SECURITY: No default. App crashes on startup if missing.
    DATABASE_URL: str

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

    # ═══════════════════════════════════════════════════════════════════
    # Phase 2 APIs
    # ═══════════════════════════════════════════════════════════════════
    
    # OMDB (free 1000 req/day)
    OMDB_API_KEY: str = ""
    
    # KinoCheck (free 1000 req/day)
    KINOCHECK_API_KEY: str = ""
    
    # The Guardian (free)
    GUARDIAN_API_KEY: str = ""
    
    # NYT (free 500 req/day)
    NYT_API_KEY: str = ""
    
    # Watchmode (free 1000 req/month)
    WATCHMODE_API_KEY: str = ""
    
    # Feature Flags
    USE_LANGGRAPH: bool = False
    USE_JINA: bool = False

    # Cron — SECURITY: No default. Must be set in env.
    CRON_SECRET: str

    # Security — SECURITY: No default. Must be set in env.
    IP_HASH_SALT: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()