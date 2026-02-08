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

    # ═══════════════════════════════════════════════════════════════════
    # Phase 2 APIs
    # ═══════════════════════════════════════════════════════════════════
    
    # OMDB (free 1000 req/day — https://www.omdbapi.com/apikey.aspx)
    OMDB_API_KEY: str = ""
    
    # KinoCheck (free 1000 req/day — https://www.kinocheck.com/api)
    KINOCHECK_API_KEY: str = ""
    
    # The Guardian (free — https://open-platform.theguardian.com/access/)
    GUARDIAN_API_KEY: str = ""
    
    # NYT (free 500 req/day — https://developer.nytimes.com/)
    NYT_API_KEY: str = ""
    
    # Watchmode (free 1000 req/month — https://api.watchmode.com/)
    WATCHMODE_API_KEY: str = ""
    
    # TVMaze is FREE — no API key required!
    
    # Feature Flags
    USE_LANGGRAPH: bool = False  # Toggle between LangGraph agent and pipeline
    USE_JINA: bool = False  # Set to True to use Jina Reader instead of BeautifulSoup

    # Cron
    CRON_SECRET: str = "change-me-in-production"

    # Security
    IP_HASH_SALT: str = "change-me-in-production"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
