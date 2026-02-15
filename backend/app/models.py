"""
Worth the Watch? — SQLAlchemy Models
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, Date,
    ForeignKey, JSON, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    tmdb_id = Column(Integer, unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    original_title = Column(String(500))
    media_type = Column(String(10), nullable=False)  # 'movie' or 'tv'
    overview = Column(Text)
    poster_path = Column(String(255))
    backdrop_path = Column(String(255))
    genres = Column(JSON)  # [{"id": 28, "name": "Action"}, ...]
    release_date = Column(Date)
    tmdb_popularity = Column(Float)
    tmdb_vote_average = Column(Float)
    tmdb_vote_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    review = relationship("Review", back_populates="movie", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_movies_release_date", "release_date"),
        Index("idx_movies_media_type", "media_type"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), unique=True, nullable=False)
    verdict = Column(String(20), nullable=False)  # 'WORTH IT', 'NOT WORTH IT', 'MIXED BAG'
    review_text = Column(Text, nullable=False)
    praise_points = Column(JSON)  # ["great performances", ...]
    criticism_points = Column(JSON)  # ["slow pacing", ...]
    vibe = Column(String(255))
    confidence = Column(String(10))  # 'HIGH', 'MEDIUM', 'LOW'
    sources_count = Column(Integer, default=0)
    sources_urls = Column(JSON)  # List of URLs analyzed
    llm_model = Column(String(50))
    generated_at = Column(DateTime, default=datetime.utcnow)

    # Phase 2 fields (nullable for now)
    imdb_score = Column(Float, nullable=True)
    rt_critic_score = Column(Integer, nullable=True)
    rt_audience_score = Column(Integer, nullable=True)
    metascore = Column(Integer, nullable=True)
    controversial = Column(Boolean, default=False)
    positive_pct = Column(Integer, nullable=True)
    negative_pct = Column(Integer, nullable=True)
    mixed_pct = Column(Integer, nullable=True)
    trailer_url = Column(String(500), nullable=True)
    last_refreshed_at = Column(DateTime, nullable=True)

    # Verdict DNA (Phase 3)
    tags = Column(JSON, default=[])  # ["Fast-Paced", "Gory"]
    best_quote = Column(Text, nullable=True)
    quote_source = Column(String(255), nullable=True)

    # Review Voice & Critics vs Reddit (Phase 4)
    hook = Column(Text, nullable=True)
    who_should_watch = Column(Text, nullable=True)
    who_should_skip = Column(Text, nullable=True)
    critic_sentiment = Column(String(20), nullable=True)  # 'positive', 'mixed', 'negative'
    reddit_sentiment = Column(String(20), nullable=True)  # 'positive', 'mixed', 'negative'
    critics_agree_with_reddit = Column(Boolean, nullable=True)
    tension_point = Column(Text, nullable=True)

    # Relationship
    movie = relationship("Movie", back_populates="review")

    __table_args__ = (
        Index("idx_reviews_verdict", "verdict"),
        Index("idx_reviews_generated_at", "generated_at"),
    )


class SearchEvent(Base):
    __tablename__ = "search_events"

    id = Column(Integer, primary_key=True, index=True)
    query = Column(String(500))
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=True)
    ip_hash = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_search_events_created", "created_at"),
    )


class BattleCache(Base):
    """Cache for AI-generated versus battle results."""
    __tablename__ = "battle_cache"

    id = Column(Integer, primary_key=True, index=True)
    # Always store the smaller tmdb_id as movie_a_id for consistent lookups
    movie_a_id = Column(Integer, nullable=False)
    movie_b_id = Column(Integer, nullable=False)
    winner_id = Column(Integer, nullable=False)
    loser_id = Column(Integer, nullable=False)
    winner_title = Column(String(500))
    loser_title = Column(String(500))
    kill_reason = Column(Text)
    breakdown = Column(Text)
    winner_headline = Column(String(255))
    loser_headline = Column(String(255))
    result_json = Column(JSON)  # Full response JSON for future-proofing
    llm_model = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("idx_battle_cache_pair", "movie_a_id", "movie_b_id", unique=True),
    )

