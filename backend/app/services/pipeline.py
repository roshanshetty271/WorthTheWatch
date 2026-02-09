"""
Worth the Watch? — Review Generation Pipeline
Orchestrates: Search → Read → Grep → Synthesize → Cache
This is the core of the app.
"""

import logging
from datetime import date, datetime
from typing import Optional
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

# Phase 2 imports
from app.services.omdb import omdb_service
from app.services.kinocheck import kinocheck_service, youtube_embed_url
from app.services.guardian import guardian_service
from app.services.nyt import nyt_service

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
    
    If USE_LANGGRAPH=true, uses the LangGraph agent for adaptive review generation.
    Otherwise, uses the procedural pipeline (faster, simpler).

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

    # ─── LangGraph Agent Route ────────────────────────────────
    if settings.USE_LANGGRAPH:
        logger.info(f"🤖 Using LangGraph agent for '{title}'")
        job_progress[tmdb_id] = "Running LangGraph agent..."
        
        try:
            from app.services.agent import run_agent_pipeline
            result = await run_agent_pipeline(movie)
            
            if result.get("error"):
                logger.error(f"LangGraph agent error: {result['error']}")
                # Fall through to procedural pipeline as fallback
            elif result.get("llm_output"):
                llm_output = result["llm_output"]
                
                # Create review from agent output
                review = Review(
                    movie_id=movie.id,
                    verdict=llm_output.verdict,
                    overall=llm_output.overall,
                    positives=llm_output.positives,
                    negatives=llm_output.negatives,
                    audience_reactions=llm_output.audience_reactions,
                    recommendation=llm_output.recommendation,
                    sources=result.get("search_results", [])[:5],
                    llm_model=llm_model,
                    created_at=datetime.utcnow(),
                    trailer_url=result.get("trailer_url"),
                    positive_pct=llm_output.positive_pct,
                    negative_pct=llm_output.negative_pct,
                    mixed_pct=llm_output.mixed_pct,
                )
                
                # Apply OMDB scores if present
                omdb = result.get("omdb_scores")
                if omdb and isinstance(omdb, dict):
                    review.imdb_score = omdb.get("imdb_score")
                    review.imdb_votes = omdb.get("imdb_votes")
                    review.rt_critic_score = omdb.get("rt_critic_score")
                    review.metascore = omdb.get("metascore")
                
                db.add(review)
                await db.commit()
                await db.refresh(review)
                
                job_progress.pop(tmdb_id, None)
                logger.info(f"✅ LangGraph review complete: '{title}' → {review.verdict}")
                return review
        except ImportError:
            logger.warning("langgraph not installed, falling back to pipeline")
        except Exception as e:
            logger.error(f"LangGraph failed, falling back to pipeline: {e}")
    
    # ─── Procedural Pipeline Route ────────────────────────────
    job_progress[tmdb_id] = "Searching for reviews..."
    logger.info(f"🔍 Step 1/4: Searching for reviews of '{title}' ({year})")

    # ─── Step 1: SEARCH ────────────────────────────────────
    try:
        # Three parallel searches for diverse sources
        job_progress[tmdb_id] = "Searching for reviews..."
        critic_results, reddit_results, forum_results = await asyncio.gather(
            serper_service.search_reviews(title, year),
            serper_service.search_reddit(title, year),
            serper_service.search_forums(title, year),
            return_exceptions=True,
        )
        # Handle individual failures gracefully
        if isinstance(critic_results, Exception):
            logger.error(f"Critic search failed: {critic_results}")
            critic_results = []
        if isinstance(reddit_results, Exception):
            logger.error(f"Reddit search failed: {reddit_results}")
            reddit_results = []
        if isinstance(forum_results, Exception):
            logger.error(f"Forum search failed: {forum_results}")
            forum_results = []
    except Exception as e:
        logger.error(f"Serper search failed: {e}")
        critic_results, reddit_results, forum_results = [], [], []

    all_results = critic_results + reddit_results + forum_results
    
    # ─── Step 1b: Guardian + NYT (Phase 2) ─────────────────
    try:
        guardian_results, nyt_results = await asyncio.gather(
            guardian_service.search_film_reviews(title, year),
            nyt_service.search_reviews(title),
            return_exceptions=True,
        )
        if isinstance(guardian_results, Exception):
            logger.warning(f"Guardian search failed: {guardian_results}")
            guardian_results = []
        if isinstance(nyt_results, Exception):
            logger.warning(f"NYT search failed: {nyt_results}")
            nyt_results = []
        
        # Add critic URLs to results
        for article in guardian_results:
            all_results.append({"title": article.headline, "link": article.url, "snippet": article.snippet})
        for review in nyt_results:
            all_results.append({"title": review.headline, "link": review.url, "snippet": review.summary})
        
        if guardian_results or nyt_results:
            logger.info(f"   → Added {len(guardian_results)} Guardian + {len(nyt_results)} NYT reviews")
    except Exception as e:
        logger.warning(f"Phase 2 critic APIs failed: {e}")

    if not all_results:
        logger.warning(f"No search results found for '{title}'")
        job_progress.pop(tmdb_id, None)
        # Create low-confidence review from metadata only
        return await _create_fallback_review(db, movie, genres)

    # Select diverse, high-quality sources
    selected_urls = select_best_sources(all_results, max_total=12)  # Increased from 8 for better accuracy
    logger.info(f"📖 Step 2/4: Reading {len(selected_urls)} articles for '{title}'")
    
    # DEBUG: Log each URL being fetched
    logger.info("=" * 60)
    logger.info("📋 SOURCES BEING FETCHED:")
    for i, url in enumerate(selected_urls, 1):
        logger.info(f"   {i}. {url[:100]}...")
    logger.info("=" * 60)

    # ─── Step 2: READ ──────────────────────────────────────
    job_progress[tmdb_id] = "Gathering opinions..."
    articles = await jina_service.read_urls(selected_urls, max_concurrent=10)
    logger.info(f"   → Successfully read {len(articles)} articles")
    
    # DEBUG: Log content lengths from each article
    logger.info("📊 ARTICLE CONTENT LENGTHS:")
    total_chars = 0
    for i, article in enumerate(articles, 1):
        char_count = len(article) if article else 0
        total_chars += char_count
        logger.info(f"   Article {i}: {char_count:,} chars")
    logger.info(f"   TOTAL: {total_chars:,} characters from {len(articles)} articles")

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
    
    # DEBUG: Log filtered content
    logger.info(f"🔍 FILTERED OPINIONS: {len(filtered_opinions):,} chars (from {total_chars:,} raw chars)")

    if not filtered_opinions or len(filtered_opinions) < 50:
        # Use raw snippets as fallback
        filtered_opinions = "\n\n".join(
            f"{r['title']}: {r['snippet']}" for r in all_results[:15]
        )
        logger.info(f"   ⚠️ Using fallback snippets: {len(filtered_opinions)} chars")

    # ─── Step 4: SYNTHESIZE ────────────────────────────────
    job_progress[tmdb_id] = "Writing your verdict..."
    logger.info(f"🧠 Step 4/4: Generating review with LLM for '{title}'")
    logger.info(f"   → Sending {len(filtered_opinions[:18000]):,} chars to LLM")
    logger.info(f"   → TMDB Score: {movie.tmdb_vote_average}")
    
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
        logger.info(f"✅ LLM RESPONSE RECEIVED:")
        logger.info(f"   → Verdict: {llm_output.verdict}")
        logger.info(f"   → Praise Points: {len(llm_output.praise_points or [])} items")
        logger.info(f"   → Criticism Points: {len(llm_output.criticism_points or [])} items")
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
    
    # ─── Step 6: ENRICH (Phase 2) ─────────────────────────
    job_progress[tmdb_id] = "Finalizing your review..."
    logger.info(f"🎬 Step 5/5: Fetching OMDB scores and trailer for '{title}'")
    
    try:
        # Parallel fetch: OMDB scores + trailer (try KinoCheck then TMDB)
        omdb_task = omdb_service.get_scores_by_title(
            title, year, "series" if movie.media_type == "tv" else "movie"
        )
        trailer_task = _get_best_trailer(movie.tmdb_id, movie.media_type or "movie")
        
        omdb_scores, trailer_url = await asyncio.gather(
            omdb_task, trailer_task, return_exceptions=True
        )
        
        # Apply OMDB scores
        if not isinstance(omdb_scores, Exception):
            review.imdb_score = omdb_scores.imdb_score
            review.rt_critic_score = omdb_scores.rt_critic_score
            review.metascore = omdb_scores.metascore
            # Calculate controversial flag (RT critic vs audience gap > 25)
            if omdb_scores.rt_critic_score and review.rt_audience_score:
                gap = abs(omdb_scores.rt_critic_score - review.rt_audience_score)
                review.controversial = gap > 25
        
        # Apply trailer
        if not isinstance(trailer_url, Exception) and trailer_url:
            review.trailer_url = trailer_url
        
        # Apply sentiment from LLM output
        review.positive_pct = llm_output.positive_pct
        review.negative_pct = llm_output.negative_pct
        review.mixed_pct = llm_output.mixed_pct
        review.last_refreshed_at = datetime.utcnow()
        
        await db.flush()
    except Exception as e:
        logger.warning(f"Phase 2 enrichment failed: {e}")
    
    job_progress.pop(tmdb_id, None)
    return review


async def _get_best_trailer(tmdb_id: int, media_type: str) -> Optional[str]:
    """Try KinoCheck first, then fallback to TMDB videos."""
    # 1. Try KinoCheck (Official trailers)
    try:
        trailer_id = await kinocheck_service.get_trailer_by_tmdb_id(tmdb_id, media_type)
        if trailer_id:
            return youtube_embed_url(trailer_id)
    except Exception:
        pass

    # 2. Fallback to TMDB (Official videos)
    try:
        videos = await tmdb_service.get_videos(tmdb_id, media_type)
        if videos:
            # helper to find best match
            for v in videos:
                if v.get("site") == "YouTube" and v.get("type") == "Trailer":
                    return youtube_embed_url(v["key"])
            
            # If no trailer, take first result (Teaser/Clip)
            if videos:
                 return youtube_embed_url(videos[0]["key"])
    except Exception:
        pass
        
    return None


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
