"""
Worth the Watch? — Pydantic Schemas
Separate from SQLAlchemy models. Handles API validation & serialization.
"""

from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional


# ─── Movie Schemas ────────────────────────────────────────

class MovieBase(BaseModel):
    tmdb_id: int
    title: str
    media_type: str
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    genres: Optional[list[dict]] = None
    release_date: Optional[date] = None
    tmdb_popularity: Optional[float] = None
    tmdb_vote_average: Optional[float] = None

    @field_validator("release_date", mode="before")
    @classmethod
    def parse_release_date(cls, v):
        """Handle TMDB returning dates as strings or empty strings."""
        if v is None or v == "":
            return None
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            try:
                return date.fromisoformat(v)
            except (ValueError, TypeError):
                return None
        return None


class MovieResponse(MovieBase):
    id: int
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Review Schemas ───────────────────────────────────────

class ReviewResponse(BaseModel):
    verdict: str
    review_text: str
    praise_points: Optional[list[str]] = None
    criticism_points: Optional[list[str]] = None
    vibe: Optional[str] = None
    confidence: Optional[str] = None
    sources_count: Optional[int] = None
    generated_at: Optional[datetime] = None
    imdb_score: Optional[float] = None
    rt_critic_score: Optional[int] = None
    rt_audience_score: Optional[int] = None
    controversial: Optional[bool] = False
    # Phase 2 additions
    trailer_url: Optional[str] = None
    positive_pct: Optional[int] = None
    negative_pct: Optional[int] = None
    mixed_pct: Optional[int] = None

    model_config = {"from_attributes": True}


class MovieWithReview(BaseModel):
    movie: MovieResponse
    review: Optional[ReviewResponse] = None


# ─── LLM Output Schema ───────────────────────────────────

# Strict Taxonomy for Verdict DNA
ALLOWED_TAGS = {
    "Fast-Paced", "Slow-Burn", "Action-Packed", "Cerebral",
    "Feel-Good", "Dark", "Gritty", "Whimsical", "Funny",
    "Gory", "Violent", "Sexy", "Family-Friendly",
    "Mind-Bending", "Dialogue-Heavy", "Visual-Masterpiece"
}

class LLMReviewOutput(BaseModel):
    """Expected JSON output from the LLM synthesis step."""
    review_text: str
    verdict: str = Field(pattern=r"^(WORTH IT|NOT WORTH IT|MIXED BAG)$")
    praise_points: list[str] = Field(default_factory=list)
    criticism_points: list[str] = Field(default_factory=list)
    vibe: str = ""
    confidence: str = Field(default="MEDIUM", pattern=r"^(HIGH|MEDIUM|LOW)$")
    
    # Verdict DNA
    tags: list[str] = Field(default_factory=list, description="List of 3-5 tags from the allowed list")
    best_quote: str = Field(default="", description="The single most memorable or funny quote from the opinions")
    quote_source: str = Field(default="", description="Source of the quote (e.g. 'Reddit User', 'NYT Critic')")

    # Sentiment breakdown (Phase 2)
    positive_pct: Optional[int] = None
    negative_pct: Optional[int] = None
    mixed_pct: Optional[int] = None

    @field_validator('tags', mode='after')
    @classmethod
    def validate_tags(cls, v):
        # Title case and filter based on ALLOWED_TAGS
        clean_tags = []
        for tag in v:
            normalized = tag.strip().title().replace(" ", "-")
            if normalized in ALLOWED_TAGS:
                clean_tags.append(normalized)
        return clean_tags[:5]  # Max 5 tags


# ─── API Response Wrappers ────────────────────────────────

class PaginatedMovies(BaseModel):
    movies: list[MovieWithReview]
    total: int
    page: int
    pages: int


class SearchResult(BaseModel):
    found_in_db: bool
    movie: Optional[MovieWithReview] = None
    tmdb_results: Optional[list[MovieBase]] = None
    generation_status: Optional[str] = None  # 'generating', 'completed', 'failed'


class GenerationStatus(BaseModel):
    status: str  # 'pending', 'generating', 'completed', 'failed'
    movie: Optional[MovieWithReview] = None


class HealthCheck(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    database: Optional[str] = None
    tmdb: Optional[str] = None
    llm: Optional[str] = None
    serper: Optional[str] = None
