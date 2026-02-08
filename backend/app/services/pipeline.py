"""
Worth the Watch? — Review Generation Pipeline
Orchestrates: Search → Read → Grep → Synthesize → Cache
This is the core of the app.
"""

import logging
from datetime import date, datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio

from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.serper import serper_service
from app.services.jina import jina_service
from app.services.grep import extract_opinion_paragraphs, select_best_sources
from app.services.llm import synthesize_review, llm_model
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def get_or_create_movie(db: AsyncSession, tmdb_id: int, media_type: str = "movie") -> Movie:
    """Get movie from DB or fetch from TMDB and save.
    
    Handles race conditions where multiple requests try to insert the same movie.
    """
    # First check if movie already exists
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()

    if movie:
        return movie

    # Fetch from TMDB
    if media_type == "tv":
        tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
        tmdb_data["media_type"] = "tv"
    else:
        tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
        tmdb_data["media_type"] = "movie"

    normalized = tmdb_service.normalize_result(tmdb_data)
    
    # Remove computed fields that aren't DB columns
    normalized.pop("poster_url", None)
    normalized.pop("backdrop_url", None)
    normalized.pop("tmdb_vote_count", None)
    normalized.pop("original_title", None)

    # Parse release_date string to date object before creating Movie
    release_date_val = None
    release_str = normalized.pop("release_date", None)
    if release_str:
        try:
            release_date_val = date.fromisoformat(str(release_str))
        except (ValueError, TypeError):
            release_date_val = None

    # Re-check DB in case another request inserted while we were fetching from TMDB
    result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
    movie = result.scalar_one_or_none()
    if movie:
        return movie

    # Try to insert, handle race condition gracefully
    try:
        movie = Movie(**normalized, release_date=release_date_val)
        db.add(movie)
        await db.flush()
        return movie
    except Exception as e:
        # If duplicate key error, rollback and fetch the existing record
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            await db.rollback()
            result = await db.execute(select(Movie).where(Movie.tmdb_id == tmdb_id))
            movie = result.scalar_one_or_none()
            if movie:
                return movie
        raise


# Global progress tracker: {tmdb_id: "Step description"}
job_progress = {}

async def generate_review_for_movie(db: AsyncSession, movie: Movie) -> Review:
    """
    Full pipeline: Search → Read → Grep → Synthesize → Cache

    Steps:
    1. SEARCH: Serper finds review articles + Reddit threads
    2. READ: Jina Reader extracts full content (parallel)
    3. GREP: Python keyword-filters opinion paragraphs
    4. SYNTHESIZE: DeepSeek generates review + verdict
    5. CACHE: Save to PostgreSQL
    """
    tmdb_id = movie.tmdb_id
    title = movie.title
    year = str(movie.release_date.year) if movie.release_date else ""
    genres = ", ".join(g.get("name", "") for g in (movie.genres or []) if g.get("name"))

    job_progress[tmdb_id] = "Searching for reviews..."
    logger.info(f"🔍 Step 1/4: Searching for reviews of '{title}' ({year})")

    # ─── Step 1: SEARCH ────────────────────────────────────
    try:
        # Two parallel searches for diverse sources
        job_progress[tmdb_id] = "Searching for reviews..."
        critic_results, reddit_results = await asyncio.gather(
            serper_service.search_reviews(title, year),
            serper_service.search_reddit(title, year),
            return_exceptions=True,
        )
        # Handle individual failures gracefully
        if isinstance(critic_results, Exception):
            logger.error(f"Critic search failed: {critic_results}")
            critic_results = []
        if isinstance(reddit_results, Exception):
            logger.error(f"Reddit search failed: {reddit_results}")
            reddit_results = []
    except Exception as e:
        logger.error(f"Serper search failed: {e}")
        critic_results, reddit_results = [], []

    all_results = critic_results + reddit_results

    if not all_results:
        logger.warning(f"No search results found for '{title}'")
        job_progress.pop(tmdb_id, None)
        # Create low-confidence review from metadata only
        return await _create_fallback_review(db, movie, genres)

    # Select diverse, high-quality sources
    selected_urls = select_best_sources(all_results, max_total=12)  # Increased from 8 for better accuracy
    logger.info(f"📖 Step 2/4: Reading {len(selected_urls)} articles for '{title}'")

    # ─── Step 2: READ ──────────────────────────────────────
    job_progress[tmdb_id] = "Gathering opinions..."
    articles = await jina_service.read_urls(selected_urls, max_concurrent=10)
    logger.info(f"   → Successfully read {len(articles)} articles")

    if not articles:
        # Fall back to using just the search snippets
        snippets = "\n\n".join(
            f"Source: {r['title']}\n{r['snippet']}" for r in all_results[:10]
        )
        articles = [snippets]

    # ─── Step 3: GREP ──────────────────────────────────────
    job_progress[tmdb_id] = "Analyzing feedback..."
    logger.info(f"🔎 Step 3/4: Filtering opinions from {len(articles)} articles")
    filtered_opinions = extract_opinion_paragraphs(articles)

    if not filtered_opinions or len(filtered_opinions) < 50:
        # Use raw snippets as fallback
        filtered_opinions = "\n\n".join(
            f"{r['title']}: {r['snippet']}" for r in all_results[:15]
        )

    # ─── Step 4: SYNTHESIZE ────────────────────────────────
    job_progress[tmdb_id] = "Writing your verdict..."
    logger.info(f"🧠 Step 4/4: Generating review with DeepSeek for '{title}'")
    
    try:
        llm_output = await synthesize_review(
            title=title,
            year=year,
            genres=genres,
            overview=movie.overview or "",
            opinions=filtered_opinions[:18000], # Truncate to fit
            sources_count=len(articles),
            tmdb_score=movie.tmdb_vote_average or 0.0,
        )
    except Exception as e:
        job_progress.pop(tmdb_id, None)
        logger.error(f"LLM generation failed: {e}")
        raise

    # ─── Step 5: CACHE ─────────────────────────────────────
    logger.info(f"💾 Saving review for '{title}'")
    
    # Check for existing review to update
    result = await db.execute(select(Review).where(Review.movie_id == movie.id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.verdict = llm_output.verdict
        existing.review_text = llm_output.review_text
        existing.praise_points = llm_output.praise_points
        existing.criticism_points = llm_output.criticism_points
        existing.vibe = llm_output.vibe
        existing.confidence = llm_output.confidence
        existing.sources_count = len(selected_urls)
        existing.sources_urls = selected_urls
        existing.llm_model = llm_model
        existing.generated_at = datetime.utcnow()
        review = existing
    else:
        review = Review(
            movie_id=movie.id,
            verdict=llm_output.verdict,
            review_text=llm_output.review_text,
            praise_points=llm_output.praise_points,
            criticism_points=llm_output.criticism_points,
            vibe=llm_output.vibe,
            confidence=llm_output.confidence,
            sources_count=len(selected_urls),
            sources_urls=selected_urls,
            llm_model=llm_model,
        )
        db.add(review)
    
    await db.flush()
    job_progress.pop(tmdb_id, None)
    return review


async def _create_fallback_review(db: AsyncSession, movie: Movie, genres: str) -> Review:
    """Create a low-confidence review when no sources are found."""
    llm_output = await synthesize_review(
        title=movie.title,
        year=str(movie.release_date.year) if movie.release_date else "",
        genres=genres,
        overview=movie.overview or "",
        opinions="Very limited crowd discussion found for this title. Base your review on the movie description and any general knowledge you have.",
        sources_count=0,
    )

    review = Review(
        movie_id=movie.id,
        verdict=llm_output.verdict,
        review_text=llm_output.review_text,
        praise_points=llm_output.praise_points,
        criticism_points=llm_output.criticism_points,
        vibe=llm_output.vibe,
        confidence="LOW",
        sources_count=0,
        sources_urls=[],
        llm_model=llm_model,
    )
    db.add(review)
    await db.flush()
    return review
