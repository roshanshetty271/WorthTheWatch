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
import unicodedata
from urllib.parse import urlparse

from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.serper import serper_service
from app.services.jina import jina_service
from app.services.grep import extract_opinion_paragraphs, select_best_sources
from app.services.llm import synthesize_review, llm_model
from app.config import get_settings

# Phase 2 imports
from app.services.omdb import omdb_service, OMDBScores
from app.services.mdblist import mdblist_service, MDBListScores
from app.services.kinocheck import kinocheck_service, youtube_embed_url
from app.services.guardian import guardian_service
from app.services.nyt import nyt_service

logger = logging.getLogger(__name__)
settings = get_settings()




async def _fetch_fallback_poster(title: str, release_date: str = None) -> Optional[str]:
    """Fetch a poster from Google Images if TMDB has none."""
    try:
        year_hint = ""
        if release_date:
            try:
                # Handle both date objects and strings
                if isinstance(release_date, str):
                    year_hint = release_date[:4]
                elif hasattr(release_date, "year"):
                    year_hint = str(release_date.year)
            except Exception:
                pass
        
        query = f"{title} {year_hint} movie poster high resolution"
        images = await serper_service.search_images(query, num_results=3)
        
        if images:
            # Return the first image URL
            return images[0].get("imageUrl")
            
    except Exception as e:
        logger.warning(f"Failed to fetch fallback poster for {title}: {e}")
    
    return None


def normalize_for_search(title: str) -> str:
    """Strip diacritical marks for search: Bāhubali → Bahubali, Amélie → Amelie"""
    nfkd = unicodedata.normalize('NFKD', title)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


def _resolve_rating_context(
    movie: Movie,
    omdb_data: Optional[OMDBScores] = None,
    mdblist_scores: Optional[MDBListScores] = None,
) -> dict:
    """Merge OMDb and MDBList into one optional score context."""
    context = {
        "tmdb_score": movie.tmdb_vote_average or 0.0,
        "tmdb_votes": movie.tmdb_vote_count or 0,
        "imdb_score": None,
        "imdb_votes": None,
        "rt_critic_score": None,
        "rt_critic_votes": None,
        "rt_audience_score": None,
        "rt_audience_votes": None,
        "metascore": None,
        "metascore_votes": None,
        "metacritic_user_score": None,
        "metacritic_user_votes": None,
        "letterboxd_score": None,
        "letterboxd_votes": None,
        "trakt_score": None,
        "trakt_votes": None,
        "rogerebert_score": None,
        "mdblist_score": None,
        "age_rating": None,
        "content_violence": None,
        "content_nudity": None,
        "content_language": None,
        "content_drinking": None,
        "budget": None,
        "revenue": None,
    }

    if omdb_data:
        if omdb_data.imdb_score is not None:
            context["imdb_score"] = omdb_data.imdb_score
        if omdb_data.imdb_votes is not None:
            context["imdb_votes"] = omdb_data.imdb_votes
        if omdb_data.rt_critic_score is not None:
            context["rt_critic_score"] = omdb_data.rt_critic_score
        if omdb_data.metascore is not None:
            context["metascore"] = omdb_data.metascore

    if mdblist_scores:
        if context["imdb_score"] is None:
            context["imdb_score"] = mdblist_scores.imdb_score
        if context["imdb_votes"] is None:
            context["imdb_votes"] = mdblist_scores.imdb_votes
        if context["rt_critic_score"] is None:
            context["rt_critic_score"] = mdblist_scores.rt_critic_score
        if mdblist_scores.rt_critic_votes is not None:
            context["rt_critic_votes"] = mdblist_scores.rt_critic_votes
        if context["metascore"] is None:
            context["metascore"] = mdblist_scores.metascore
        if mdblist_scores.metascore_votes is not None:
            context["metascore_votes"] = mdblist_scores.metascore_votes

        context["rt_audience_score"] = mdblist_scores.rt_audience_score
        context["rt_audience_votes"] = mdblist_scores.rt_audience_votes
        context["metacritic_user_score"] = mdblist_scores.metacritic_user_score
        context["metacritic_user_votes"] = mdblist_scores.metacritic_user_votes
        context["letterboxd_score"] = mdblist_scores.letterboxd_score
        context["letterboxd_votes"] = mdblist_scores.letterboxd_votes
        context["trakt_score"] = mdblist_scores.trakt_score
        context["trakt_votes"] = mdblist_scores.trakt_votes
        context["rogerebert_score"] = mdblist_scores.rogerebert_score
        context["mdblist_score"] = mdblist_scores.mdblist_score
        context["age_rating"] = mdblist_scores.age_rating
        context["content_violence"] = mdblist_scores.content_violence
        context["content_nudity"] = mdblist_scores.content_nudity
        context["content_language"] = mdblist_scores.content_language
        context["content_drinking"] = mdblist_scores.content_drinking
        context["budget"] = mdblist_scores.budget
        context["revenue"] = mdblist_scores.revenue

    return context


def _set_if_present(review: Review, field: str, value) -> None:
    """Only overwrite fields when fresh enrichment data exists."""
    if value is not None:
        setattr(review, field, value)


def _apply_review_enrichment(
    review: Review,
    rating_context: dict,
    omdb_data: Optional[OMDBScores] = None,
    mdblist_scores: Optional[MDBListScores] = None,
) -> None:
    """Apply ratings and content metadata without wiping existing values."""
    for field in (
        "imdb_score",
        "rt_critic_score",
        "rt_audience_score",
        "metascore",
        "letterboxd_score",
        "trakt_score",
        "metacritic_user_score",
        "mdblist_score",
        "rogerebert_score",
        "age_rating",
        "content_violence",
        "content_nudity",
        "content_language",
        "content_drinking",
        "budget",
        "revenue",
    ):
        _set_if_present(review, field, rating_context.get(field))

    if omdb_data:
        _set_if_present(review, "awards", getattr(omdb_data, "awards", None))
        _set_if_present(review, "box_office", getattr(omdb_data, "box_office", None))
        _set_if_present(review, "rated", getattr(omdb_data, "rated", None))

    if review.rt_critic_score is not None and review.rt_audience_score is not None:
        review.controversial = abs(review.rt_critic_score - review.rt_audience_score) > 25



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
    
    # Check for missing poster and try fallback
    if not normalized.get("poster_path"):
        logger.info(f"🖼️ Missing poster for {normalized['title']} ({tmdb_id}). Trying Serper fallback...")
        fallback_poster = await _fetch_fallback_poster(normalized["title"], normalized.get("release_date"))
        if fallback_poster:
            normalized["poster_path"] = fallback_poster
            logger.info(f"✅ Fallback poster found: {fallback_poster}")

    # Remove computed fields that aren't DB columns
    normalized.pop("poster_url", None)
    normalized.pop("backdrop_url", None)
    # normalized.pop("tmdb_vote_count", None)  <-- KEEP THIS NOW
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



def calculate_confidence(
    articles_read: int,
    total_articles_attempted: int,
    selected_urls: list[str],
    filtered_opinion_chars: int,
    release_date=None,
) -> dict:
    """
    Calculate data-aware confidence score.
    Returns dict with score (0-100), tier (HIGH/MEDIUM/LOW), and stats.
    
    Calibrated for our actual pipeline:
    - We typically read 7-10 articles successfully
    - Reddit threads are available for movies from ~2010+
    - Classic movies may have 0 Reddit but strong critic coverage
    """
    score = 0
    stats = {}
    
    # --- Source Count (max 25 pts) ---
    # Our pipeline attempts 12, typically reads 7-10
    if articles_read >= 8:
        score += 25      # Great scraping session
    elif articles_read >= 5:
        score += 15      # Decent
    elif articles_read >= 3:
        score += 8       # Thin but workable
    else:
        score += 0       # Very thin data
    stats["articles_read"] = articles_read
    
    # --- Reddit Presence (max 30 pts) ---
    # Reddit = real crowd opinions, our most valuable signal
    reddit_count = sum(1 for url in selected_urls if "reddit.com" in url.lower())
    if reddit_count >= 3:
        score += 30      # Strong crowd signal
    elif reddit_count >= 1:
        score += 15      # Some crowd signal
    else:
        score += 0       # No crowd signal (don't penalize — old movies won't have Reddit)
    stats["reddit_sources"] = reddit_count
    
    # --- Content Volume (max 25 pts) ---
    # After grep filtering, we typically get 8K-25K chars
    if filtered_opinion_chars >= 15000:
        score += 25      # Rich opinion data
    elif filtered_opinion_chars >= 8000:
        score += 15      # Decent opinion data
    elif filtered_opinion_chars >= 3000:
        score += 8       # Thin but usable
    else:
        score += 0       # Very thin
    stats["opinion_chars"] = filtered_opinion_chars
    
    # --- Movie Age / Consensus Stability (max 20 pts) ---
    if release_date:
        from datetime import date
        try:
            if isinstance(release_date, str):
                release_date = date.fromisoformat(release_date)
            days_old = (date.today() - release_date).days
            
            if days_old > 365:
                score += 20      # Old movie — consensus fully settled
            elif days_old > 90:
                score += 15      # Consensus mostly settled
            elif days_old > 30:
                score += 8       # Still forming
            else:
                score += 0       # Brand new — opinions volatile
            stats["days_since_release"] = days_old
        except:
            score += 10          # Unknown age, give benefit of doubt
            stats["days_since_release"] = None
    else:
        score += 10
        stats["days_since_release"] = None
    
    # --- Determine Tier ---
    if score >= 70:
        tier = "HIGH"
    elif score >= 40:
        tier = "MEDIUM"
    else:
        tier = "LOW"
    
    stats["confidence_score"] = score
    stats["confidence_tier"] = tier
    
    logging.getLogger(__name__).info(
        f"📊 Confidence: {score}/100 ({tier}) — "
        f"{articles_read} articles, {reddit_count} reddit, "
        f"{filtered_opinion_chars} chars"
    )
    
    return stats


# Global progress tracker: {tmdb_id: {"message": str, "percent": int}}
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
    
    # ─── Title Sanity Check ────────────────────────────────
    # Sanity check: title must be a clean movie title from TMDB
    # If title looks corrupted (Reddit thread title), refetch it
    if any(s in title.lower() for s in ["reddit", "anyone", "watched", "discussion", "experience", "..."]) or len(title) > 80:
        logger.error(f"⚠️ Corrupted title detected: '{title[:80]}'")
        try:
            if movie.media_type == "tv":
                tmdb_data = await tmdb_service.get_tv_details(movie.tmdb_id)
            else:
                tmdb_data = await tmdb_service.get_movie_details(movie.tmdb_id)
            if tmdb_data:
                clean_title = tmdb_data.get("title") or tmdb_data.get("name")
                if clean_title:
                    title = clean_title
                    movie.title = clean_title
                    logger.info(f"🔧 Title fixed: '{clean_title}'")
        except Exception as e:
            logger.error(f"Could not fix title: {e}")

    year = str(movie.release_date.year) if movie.release_date else ""
    genres = ", ".join(g.get("name", "") for g in (movie.genres or []) if g.get("name"))

    search_title = normalize_for_search(title)
    if search_title != title:
        logger.info(f"🔤 Normalized for search: '{title}' → '{search_title}'")

    # ─── Director Fetching (for search disambiguation) ─────
    # Fixes title collision: "The Call 2020" matches both the Korean thriller
    # (Lee Chung-hyun) and the American horror (Timothy Woodward Jr.).
    # Adding director name to Serper queries makes Google prefer the right film.
    # Cost: 1 TMDB API call (free, unlimited). Time: ~200ms (runs before parallel search).
    #
    # MOVIES ONLY: TV shows don't benefit from this. TV creators/showrunners
    # (e.g. "Robert Kirkman", "David Zabel") pollute Google results with
    # unrelated content (eBay listings, academic papers, obituaries).
    # TV titles are already unique enough — no one confuses "Fear the Walking Dead"
    # with another show. Movies like "The Call" or "The Host" need disambiguation.
    director_name = ""
    imdb_id = None
    if movie.media_type != "tv":
        try:
            details_with_credits = await tmdb_service._get(
                f"/movie/{movie.tmdb_id}", {"append_to_response": "credits"}
            )
            if details_with_credits:
                imdb_id = details_with_credits.get("imdb_id")
                if imdb_id:
                    logger.info(f"🎬 IMDb ID from TMDB: {imdb_id}")
                if "credits" in details_with_credits:
                    crew = details_with_credits["credits"].get("crew", [])
                    directors = [c["name"] for c in crew if c.get("job") == "Director"]
                    if directors:
                        director_name = directors[0]
                        logger.info(f"🎬 Director: {director_name}")
        except Exception as e:
            logger.debug(f"Could not fetch director for '{title}': {e}")
    else:
        try:
            ext_ids = await tmdb_service.get_external_ids(movie.tmdb_id, "tv")
            if ext_ids:
                imdb_id = ext_ids.get("imdb_id")
                if imdb_id:
                    logger.info(f"🎬 IMDb ID from TMDB (TV): {imdb_id}")
        except Exception as e:
            logger.debug(f"Could not fetch external IDs for TV '{title}': {e}")
        
    # ─── LangGraph Agent Route ────────────────────────────────
    # Uses adaptive search with conditional broadening.
    # Slower and more expensive than pipeline, but better for obscure titles.
    if settings.USE_LANGGRAPH:
        logger.info(f"🤖 Using LangGraph agent for '{title}'")
        job_progress[tmdb_id] = {"message": "Running AI Agent...", "percent": 10}
        
        try:
            from app.services.agent import run_agent_pipeline
            result = await run_agent_pipeline(movie)
            
            if result.get("error"):
                logger.error(f"LangGraph agent error: {result['error']}")
                # Fall through to procedural pipeline as fallback
            elif result.get("llm_output"):
                llm_output = result["llm_output"]
                
                # Check for existing review to update
                existing_result = await db.execute(select(Review).where(Review.movie_id == movie.id))
                existing_review = existing_result.scalar_one_or_none()
                
                if existing_review:
                    existing_review.verdict = llm_output.verdict
                    existing_review.review_text = llm_output.review_text
                    existing_review.praise_points = llm_output.praise_points
                    existing_review.criticism_points = llm_output.criticism_points
                    existing_review.vibe = llm_output.vibe
                    existing_review.confidence = llm_output.confidence
                    existing_review.tags = llm_output.tags
                    existing_review.best_quote = llm_output.best_quote
                    existing_review.quote_source = llm_output.quote_source
                    existing_review.hook = llm_output.hook
                    existing_review.critic_sentiment = llm_output.critic_sentiment
                    existing_review.reddit_sentiment = llm_output.reddit_sentiment
                    existing_review.positive_pct = llm_output.positive_pct
                    existing_review.negative_pct = llm_output.negative_pct
                    existing_review.mixed_pct = llm_output.mixed_pct
                    existing_review.sources_count = len(result.get("search_results", []))
                    existing_review.sources_urls = [r.get("link", "") for r in result.get("search_results", [])[:10]]
                    existing_review.llm_model = llm_model
                    existing_review.generated_at = datetime.utcnow()
                    review = existing_review
                else:
                    review = Review(
                        movie_id=movie.id,
                        verdict=llm_output.verdict,
                        review_text=llm_output.review_text,
                        praise_points=llm_output.praise_points,
                        criticism_points=llm_output.criticism_points,
                        vibe=llm_output.vibe,
                        confidence=llm_output.confidence,
                        tags=llm_output.tags,
                        best_quote=llm_output.best_quote,
                        quote_source=llm_output.quote_source,
                        hook=llm_output.hook,
                        critic_sentiment=llm_output.critic_sentiment,
                        reddit_sentiment=llm_output.reddit_sentiment,
                        positive_pct=llm_output.positive_pct,
                        negative_pct=llm_output.negative_pct,
                        mixed_pct=llm_output.mixed_pct,
                        sources_count=len(result.get("search_results", [])),
                        sources_urls=[r.get("link", "") for r in result.get("search_results", [])[:10]],
                        llm_model=llm_model,
                    )
                    db.add(review)
                
                # Apply OMDB scores if present
                omdb = result.get("omdb_scores")
                if omdb and isinstance(omdb, dict):
                    review.imdb_score = omdb.get("imdb_score")
                    review.rt_critic_score = omdb.get("rt_critic_score")
                    review.metascore = omdb.get("metascore")
                
                # Apply trailer
                agent_trailer = result.get("trailer_url")
                if agent_trailer:
                    review.trailer_url = agent_trailer
                
                review.last_refreshed_at = datetime.utcnow()
                await db.flush()
                
                job_progress.pop(tmdb_id, None)
                logger.info(f"✅ LangGraph review complete: '{title}' → {review.verdict}")
                return review
        except ImportError:
            logger.warning("langgraph not installed, falling back to pipeline")
        except Exception as e:
            logger.error(f"LangGraph failed, falling back to pipeline: {e}")
    
    # ─── Procedural Pipeline Route ────────────────────────────
    job_progress[tmdb_id] = {"message": "Searching for reviews...", "percent": 10}
    logger.info(f"🔍 Step 1/4: Searching for reviews of '{title}' ({year})")

    # ─── Step 1: SEARCH ────────────────────────────────────
    # ─── Step 1: Search for Reviews ───────────────────────────
    # ─── Step 1: Search for Reviews ───────────────────────────
    omdb_data = None
    mdblist_scores = None
    trailer_url = None
    all_results = []

    # If TV show, append "TV series" to query to avoid generic matches (e.g. "Space" -> "Space TV series")
    # DO NOT include year here — it is passed separately to services!
    if movie.media_type == "tv":
        search_query = f"{search_title} TV series"
    else:
        search_query = search_title
        
    logger.info(f"🔍 Search Query: '{search_query}' | Year: '{year}' | Director: '{director_name or 'N/A'}'")

    try:
        # Run ALL searches in parallel — Serper + Guardian + NYT
        # Director name is passed as context to Serper for disambiguation
        # e.g. "The Call" 2020 "Lee Chung-hyun" → prefers Korean film over American remake
        director_context = director_name if director_name else ""
        logger.info(f"🚀 Step 1/4: Launching parallel searches for '{title}'...")
        omdb_coro = (
            omdb_service.get_scores_by_imdb_id(imdb_id)
            if imdb_id
            else omdb_service.get_scores_by_title(search_title, year, "series" if movie.media_type == "tv" else "movie")
        )
        mdblist_coro = mdblist_service.get_scores(movie.tmdb_id, movie.media_type or "movie")
        search_results = await asyncio.gather(
            serper_service.search_reviews(search_query, year, movie.media_type or "movie", director_context),
            serper_service.search_reddit(search_query, year, movie.media_type or "movie", director_context),
            guardian_service.search_film_reviews(search_query, year),
            nyt_service.search_reviews(search_query),
            omdb_coro,
            _get_best_trailer(movie.tmdb_id, movie.media_type or "movie"),
            mdblist_coro,
            return_exceptions=True,
        )
        
        # Unpack results
        serper_critics = search_results[0] if not isinstance(search_results[0], Exception) else []
        serper_reddit = search_results[1] if not isinstance(search_results[1], Exception) else []
        guardian_results = search_results[2] if not isinstance(search_results[2], Exception) else []
        nyt_results = search_results[3] if not isinstance(search_results[3], Exception) else []
        omdb_data = search_results[4] if not isinstance(search_results[4], Exception) else None
        trailer_url = search_results[5] if not isinstance(search_results[5], Exception) else None
        mdblist_scores = search_results[6] if not isinstance(search_results[6], Exception) else None
        
        # Year Validation — catches wrong IMDb IDs linked by TMDB
        if omdb_data and omdb_data.omdb_year and year:
            try:
                requested_year = int(year)
                response_year = int(omdb_data.omdb_year.split("–")[0].split("-")[0])
                if abs(requested_year - response_year) > 1:
                    logger.warning(
                        f"⚠️ REJECTING OMDB data: year mismatch! "
                        f"Expected ~{year}, OMDB returned '{omdb_data.omdb_year}' "
                        f"for '{omdb_data.omdb_title}' (imdbID={omdb_data.omdb_imdb_id})"
                    )
                    omdb_data = None
            except (ValueError, TypeError):
                pass

        # Vote Count Sanity Check
        if omdb_data and omdb_data.imdb_votes and movie.tmdb_vote_count:
            tmdb_votes = movie.tmdb_vote_count
            imdb_votes = omdb_data.imdb_votes
            
            if tmdb_votes > 1000 and imdb_votes < 1000:
                logger.warning(
                    f"⚠️ REJECTING IMDb Match: Suspiciously low votes. "
                    f"TMDB: {tmdb_votes} vs IMDb: {imdb_votes}. "
                    f"Likely matched a short film or obscure duplicate."
                )
                omdb_data = None

        # OMDB Staleness Detection — OMDB caches aggressively and may
        # return outdated scores (e.g. inflated early ratings with few votes
        # while the real IMDb page has 1M+ votes at a lower score).
        if omdb_data and omdb_data.imdb_score and omdb_data.imdb_votes:
            tmdb_avg = movie.tmdb_vote_average or 0
            imdb_votes = omdb_data.imdb_votes
            imdb_score = omdb_data.imdb_score
            days_old = (date.today() - movie.release_date).days if movie.release_date else 0

            score_gap = abs(imdb_score - tmdb_avg) if tmdb_avg > 0 else 0

            if score_gap > 1.5 and imdb_votes < 1000 and days_old > 14:
                logger.warning(
                    f"⚠️ OMDB data looks STALE: IMDb {imdb_score}/10 "
                    f"({imdb_votes} votes) vs TMDB {tmdb_avg}/10, "
                    f"gap={score_gap:.1f}, movie is {days_old} days old. "
                    f"Discarding OMDB scores."
                )
                omdb_data = None
        
        rating_context = _resolve_rating_context(movie, omdb_data, mdblist_scores)
        imdb_score = rating_context["imdb_score"]
        imdb_votes = rating_context["imdb_votes"]
        if imdb_score is not None:
            logger.info(f"🎬 IMDb: {imdb_score}/10 ({imdb_votes or '?'} votes)")

        # Log failures
        if isinstance(search_results[0], Exception): logger.error(f"Critic search failed: {search_results[0]}")
        if isinstance(search_results[1], Exception): logger.error(f"Reddit search failed: {search_results[1]}")
        if isinstance(search_results[2], Exception): logger.warning(f"Guardian search failed: {search_results[2]}")
        if isinstance(search_results[3], Exception): logger.warning(f"NYT search failed: {search_results[3]}")
        if isinstance(search_results[6], Exception): logger.warning(f"MDBList fetch failed: {search_results[6]}")

        # Combine all results
        all_results = serper_critics + serper_reddit
        
        # Add critic URLs to results
        for article in guardian_results:
            all_results.append({"title": article.headline, "link": article.url, "snippet": article.snippet})
        for review in nyt_results:
            all_results.append({"title": review.headline, "link": review.url, "snippet": review.summary})
        
        if guardian_results or nyt_results:
            logger.info(f"   → Added {len(guardian_results)} Guardian + {len(nyt_results)} NYT reviews")
            
    except Exception as e:
        logger.error(f"Search aggregation failed: {e}")
        all_results = []
    
    # Phase 2 critic APIs already merged in Step 1 (parallel execution)

    if not all_results:
        logger.warning(f"No search results found for '{title}'")
        job_progress.pop(tmdb_id, None)
        # Create low-confidence review from metadata only
        return await _create_fallback_review(
            db,
            movie,
            genres,
            omdb_data=omdb_data,
            mdblist_scores=mdblist_scores,
        )

    # Select diverse, high-quality sources
    selected_urls, backfill_urls = select_best_sources(all_results, movie_title=search_title, max_total=12)
    logger.info(f"📖 Step 2/4: Reading {len(selected_urls)} articles for '{title}'")
    
    # DEBUG: Log each URL being fetched
    logger.info("=" * 60)
    logger.info("📋 SOURCES BEING FETCHED:")
    for i, url in enumerate(selected_urls, 1):
        logger.info(f"   {i}. {url[:100]}...")
    logger.info("=" * 60)

    # ─── STEP: Capture Reddit snippets from Serper results ───
    # Do this BEFORE article fetching (already done, keep it)
    reddit_snippets = []
    for r in all_results:
        link = r.get("link", "").lower()
        if "reddit.com" in link:
            snippet = r.get("snippet", "")
            result_title = r.get("title", "")
            if snippet and len(snippet) > 40:
                # Try to extract subreddit from URL
                source_label = "Reddit"
                if "/r/" in link:
                    try:
                        # Extract "r/movies" from "...reddit.com/r/movies/..."
                        parts = link.split("/r/")
                        if len(parts) > 1:
                            sub = parts[1].split("/")[0]
                            source_label = f"r/{sub}"
                    except:
                        pass
                
                reddit_snippets.append(f"[Source: {source_label}]\n{snippet}")
    
    if reddit_snippets:
        logger.info(f"📋 Captured {len(reddit_snippets)} Reddit snippets from Serper")

    # ─── Step 2: READ ──────────────────────────────────────
    job_progress[tmdb_id] = {"message": "Reading articles...", "percent": 30}
    
    # ─── STEP: Read articles ───
    articles, failed_urls = await jina_service.read_urls(selected_urls, max_concurrent=5)
    
    # ─── STEP: Smart backfill — only if we're genuinely short on data ───
    if len(articles) >= 4:
        logger.info(f"📚 {len(articles)} articles sufficient — skipping backfill")
    elif backfill_urls:
        backfill_count = min(3, len(backfill_urls))
        logger.info(f"🔄 Only {len(articles)} articles — backfilling {backfill_count}")
        backfill_articles, _ = await jina_service.read_urls(
            backfill_urls[:backfill_count],
            max_concurrent=5,
            timeout=5.0,
        )
        articles.extend(backfill_articles)
        logger.info(f"📖 Backfill: +{len(backfill_articles)} articles")
    else:
        logger.info(f"📚 {len(articles)} articles, no backfill URLs available")
    
    # DEBUG: Log content lengths
    logger.info("📊 ARTICLE CONTENT LENGTHS:")
    total_chars = sum(len(a) for a in articles)
    logger.info(f"   TOTAL: {total_chars:,} characters from {len(articles)} articles")

    if not articles:
        # Fall back to using just the search snippets
        snippets = "\n\n".join(
            f"Source: {r['title']}\n{r['snippet']}" for r in all_results[:10]
        )
        articles = [snippets]

    # ─── Step 3: GREP ──────────────────────────────────────
    job_progress[tmdb_id] = {"message": "Analyzing feedback...", "percent": 60}
    logger.info(f"🔎 Step 3/4: Filtering opinions from {len(articles)} articles")
    
    # ─── STEP: Grep filter ONLY the scraped articles ───
    # Reddit snippets bypass grep — they're already pure opinion
    
    # NEW: Source Labeling & Per-Article Extraction
    # 1. Sync URLs with Articles (include backfill)
    final_source_urls = list(selected_urls)
    if len(articles) > len(selected_urls) and backfill_urls:
         # Add backfill URLs corresponding to the extra articles
         backfilled_count = len(articles) - len(selected_urls)
         final_source_urls.extend(backfill_urls[:backfilled_count])

    reddit_article_sections = []
    critic_article_sections = []
    
    for url, article_text in zip(final_source_urls, articles):
        best_paras = extract_opinion_paragraphs([article_text], max_paragraphs=5)
        
        if best_paras:
            try:
                domain = urlparse(url).netloc.replace('www.', '')
            except:
                domain = "Source"
            
            section = f"[Source: {domain}]\n{best_paras}"
            if "reddit.com" in url.lower():
                reddit_article_sections.append(section)
            else:
                critic_article_sections.append(section)

    # Reddit articles first, then critics
    filtered_opinions = "\n\n".join(reddit_article_sections + critic_article_sections)
    
    logger.info(
        f"🔍 FILTERED OPINIONS: {len(filtered_opinions)} chars "
        f"(from {total_chars} raw chars)"
    )
    
    # ─── OPTIMIZATION: Prioritize Reddit, but use FULL context window ───
    # We want to give Reddit (audience) priority in the context window.
    # But we have 128k context with GPT-4o-mini, so we should use ~18k chars easily.
    # No need to aggressively truncate to 5k.
    
    MAX_LLM_CHARS = 10000
    
    # 1. Prepare Reddit Text
    reddit_text = ""
    if reddit_snippets:
        reddit_text = "\n\n".join(reddit_snippets)
    
    # 2. Calculate remaining budget for critics
    if reddit_text:
        # Reserve space for Reddit (up to 3000 chars roughly, or whatever it is)
        # We process Reddit first, so we just subtract its length from the budget
        valuable_reddit_len = min(len(reddit_text), 5000) # Cap Reddit impact on budget if it's huge
        critic_limit = MAX_LLM_CHARS - valuable_reddit_len
    else:
        critic_limit = MAX_LLM_CHARS

    # 3. Truncate Critics if needed
    critic_text = filtered_opinions
    if len(critic_text) > critic_limit:
        critic_text = critic_text[:critic_limit]
        # Clean cut at last period
        last_period = critic_text.rfind('.')
        if last_period > 0:
            critic_text = critic_text[:last_period+1]
        
    # 4. Assemble Final Input: Reddit FIRST
    # Separate Reddit article opinions from critic opinions
    reddit_articles_text = "\n\n".join(reddit_article_sections)
    critic_articles_text = "\n\n".join(critic_article_sections)
    
    # Budget: Reddit snippets + Reddit articles get 50%, critics get 50%
    half_budget = MAX_LLM_CHARS // 2
    
    # All Reddit content (snippets + full thread opinions)
    all_reddit = ""
    if reddit_text:
        all_reddit = reddit_text
    if reddit_articles_text:
        all_reddit = all_reddit + "\n\n" + reddit_articles_text if all_reddit else reddit_articles_text
    all_reddit = all_reddit[:half_budget]
    
    # Critic content gets the other half
    critic_final = critic_articles_text[:half_budget]
    # Clean cut at last period
    last_period = critic_final.rfind('.')
    if last_period > 0:
        critic_final = critic_final[:last_period + 1]
    
    if all_reddit and critic_final:
        final_opinions = f"""AUDIENCE REACTIONS (Reddit & Forums):
{all_reddit}

CRITIC REVIEWS (Professional):
{critic_final}"""
    elif all_reddit:
        final_opinions = f"""AUDIENCE REACTIONS (Reddit & Forums):
{all_reddit}"""
    else:
        final_opinions = f"""CRITIC REVIEWS (Professional):
{critic_final}"""

    filtered_opinions = final_opinions

    logger.info(f"📨 Sending {len(filtered_opinions)} chars to LLM (Reddit First + Critics)")

    if len(filtered_opinions) < 100 and not reddit_text:
        # Use raw snippets as fallback if we have absolutely nothing
        filtered_opinions = "\n\n".join(
            f"{r['title']}: {r['snippet']}" for r in all_results[:15]
        )
        logger.info(f"   ⚠️ Using fallback snippets: {len(filtered_opinions)} chars")

    # ─── Step 4: SYNTHESIZE ────────────────────────────────
    job_progress[tmdb_id] = {"message": "Writing your verdict...", "percent": 80}
    logger.info(f"🧠 Step 4/4: Generating review with LLM for '{title}'")
    logger.info(f"   → Sending {len(filtered_opinions)} chars to LLM")
    logger.info(f"   → TMDB Score: {movie.tmdb_vote_average}")
    
    # Calculate confidence from actual data metrics
    confidence_stats = calculate_confidence(
        articles_read=len(articles),
        total_articles_attempted=len(selected_urls),
        selected_urls=selected_urls,
        filtered_opinion_chars=len(filtered_opinions),
        release_date=movie.release_date,
    )
    
    # TMDB Confidence Override
    # If the movie has strong TMDB data, our scraping failure 
    # shouldn't make it look like a low-data movie
    tmdb_votes = movie.tmdb_vote_count or 0
    
    if confidence_stats["confidence_tier"] == "LOW" and tmdb_votes > 300:
        logger.info(
            f"📊 Confidence override: LOW → MEDIUM "
            f"(TMDB has {tmdb_votes} votes, scraping missed data)"
        )
        confidence_stats["confidence_tier"] = "MEDIUM"
        confidence_stats["confidence_score"] = max(
            confidence_stats["confidence_score"], 55
        )
    
    if confidence_stats["confidence_tier"] in ("LOW", "MEDIUM") and tmdb_votes > 1000:
        logger.info(
            f"📊 Confidence override → HIGH "
            f"(TMDB has {tmdb_votes} votes, strong crowd consensus)"
        )
        confidence_stats["confidence_tier"] = "HIGH"
        confidence_stats["confidence_score"] = max(
            confidence_stats["confidence_score"], 75
        )

    try:
        rating_context = _resolve_rating_context(movie, omdb_data, mdblist_scores)
        imdb_score = rating_context["imdb_score"]
        imdb_votes = rating_context["imdb_votes"]
        llm_output = await synthesize_review(
            title=title,
            year=year,
            genres=genres,
            overview=movie.overview or "",
            opinions=filtered_opinions, # Already truncated
            sources_count=len(articles),
            tmdb_score=rating_context["tmdb_score"],
            tmdb_vote_count=rating_context["tmdb_votes"],
            imdb_score=imdb_score,
            imdb_votes=imdb_votes,
            rt_critic_score=rating_context["rt_critic_score"],
            rt_critic_votes=rating_context["rt_critic_votes"],
            rt_audience_score=rating_context["rt_audience_score"],
            rt_audience_votes=rating_context["rt_audience_votes"],
            metascore=rating_context["metascore"],
            metascore_votes=rating_context["metascore_votes"],
            metacritic_user_score=rating_context["metacritic_user_score"],
            metacritic_user_votes=rating_context["metacritic_user_votes"],
            letterboxd_score=rating_context["letterboxd_score"],
            letterboxd_votes=rating_context["letterboxd_votes"],
            trakt_score=rating_context["trakt_score"],
            trakt_votes=rating_context["trakt_votes"],
            rogerebert_score=rating_context["rogerebert_score"],
            confidence_tier=confidence_stats["confidence_tier"],
            articles_read=confidence_stats["articles_read"],
            reddit_sources=confidence_stats["reddit_sources"],
            media_type=movie.media_type or "movie",
        )
        
        
        # Initialize override variables early to prevent UnboundLocalError
        override_score = imdb_score if imdb_score is not None else movie.tmdb_vote_average
        override_votes = imdb_votes if imdb_votes is not None else (movie.tmdb_vote_count or 0)
        score_source = "IMDb" if imdb_score is not None else "TMDB"

        # Sanity check: verdict should match sentiment percentages
        if llm_output.positive_pct is not None and llm_output.negative_pct is not None:
            pos = llm_output.positive_pct
            neg = llm_output.negative_pct
            
            # High Score Privilege — crowd has spoken
            logger.info(f"📊 Using {score_source} score for overrides: {override_score}/10 ({override_votes} votes)")

            min_votes = 500
            if movie.release_date:
                days_old = (date.today() - movie.release_date).days
                if days_old <= 14:
                    min_votes = 100
                elif days_old <= 30:
                    min_votes = 150
                elif days_old <= 90:
                    min_votes = 250
                logger.info(f"📊 Release-aware vote threshold: {min_votes} (movie is {days_old} days old)")

            if (
                override_score and override_score > 7.5
                and override_votes and override_votes > min_votes
                and llm_output.verdict != "WORTH IT"
            ):
                # Sanity check: Don't override if LLM had strong negative signals
                criticism_count = len(llm_output.criticism_points or [])
                praise_count = len(llm_output.praise_points or [])
                
                # If LLM found MORE criticisms than praise, respect the LLM
                if criticism_count > praise_count:
                    logger.info(
                        f"⚠️ High Score Privilege BLOCKED for {title}: "
                        f"{criticism_count} criticisms > {praise_count} praise — "
                        f"LLM found genuine issues despite high score"
                    )
                elif llm_output.positive_pct and llm_output.positive_pct < 45:
                    logger.info(
                        f"⚠️ High Score Privilege BLOCKED for {title}: "
                        f"only {llm_output.positive_pct}% positive"
                    )
                else:
                    logger.info(
                        f"⭐ High Score Privilege: {title} "
                        f"({score_source} {override_score}) → WORTH IT"
                    )
                    llm_output.verdict = "WORTH IT"
            
            # NOT WORTH IT requires strong negative signal (Relaxed cutoff)
            if llm_output.verdict == "NOT WORTH IT" and pos > 60:
                logger.info(f"⚖️ Verdict override: NOT WORTH IT → MIXED BAG (positive {pos}%)")
                llm_output.verdict = "MIXED BAG"
        
        # ─── Low Score Safety Net ───
        # If score is below 6.0 with decent vote count,
        # the movie is generally considered bad. The LLM should not 
        # give it WORTH IT unless the internet OVERWHELMINGLY disagrees.
        
        if (
            llm_output.verdict == "NOT WORTH IT"
            and imdb_score is not None
            and imdb_score >= 7.0
            and imdb_votes is not None
            and imdb_votes > 500
        ):
            logger.info(f"IMDb Floor: {imdb_score}/10 ({imdb_votes} votes) -> MIXED BAG")
            llm_output.verdict = "MIXED BAG"

        # Check determined override score
        if (
            override_score and override_score < 6.0
            and override_votes and override_votes > 100
            and llm_output.verdict == "WORTH IT"
        ):
            # Only allow WORTH IT if positive sentiment is very strong (80%+)
            if llm_output.positive_pct and llm_output.positive_pct >= 80:
                logger.info(
                    f"⚠️ Low Score Override ALLOWED: {title} "
                    f"({score_source} {override_score} but {llm_output.positive_pct}% positive — "
                    f"internet disagrees)"
                )
                # Keep WORTH IT
            else:
                logger.info(
                    f"⚠️ Low Score Safety Net: {title} "
                    f"({score_source} {override_score}, {override_votes} votes, "
                    f"positive only {llm_output.positive_pct}%) "
                    f"WORTH IT → MIXED BAG"
                )
                llm_output.verdict = "MIXED BAG"
        
        # Movies below 5.0 with 200+ votes should NEVER be WORTH IT
        if (
            override_score and override_score < 5.0
            and override_votes and override_votes > 200
            and llm_output.verdict in ("WORTH IT", "MIXED BAG")
        ):
            logger.info(
                f"🚫 Hard Low Score Override: {title} "
                f"({score_source} {override_score}, {override_votes} votes) "
                f"WORTH IT → NOT WORTH IT"
            )
            llm_output.verdict = "NOT WORTH IT"
        
        # Movies between 5.0-6.0 that LLM says WORTH IT → downgrade to MIXED BAG
        # unless internet is overwhelmingly positive
        if (
            override_score and 5.0 <= override_score < 6.0
            and override_votes and override_votes > 200
            and llm_output.verdict == "WORTH IT"
            and (not llm_output.positive_pct or llm_output.positive_pct < 80)
        ):
            logger.info(
                f"⚠️ Low Score Safety Net: {title} "
                f"({score_source} {override_score}) WORTH IT → MIXED BAG"
            )
            llm_output.verdict = "MIXED BAG"

        # ─── 6.0-7.0 Mid-Score Calibration ───────────────────
        # Only override when we DON'T have strong data.
        # If we have solid article/Reddit coverage, the LLM actually
        # read the opinions — trust it over a single IMDb number.
        #
        # "Strong data" = 5+ articles OR 2+ Reddit sources OR 5000+ opinion chars
        # When data is thin, IMDb becomes a more important signal.
        has_strong_data = (
            confidence_stats["articles_read"] >= 5
            or confidence_stats.get("reddit_sources", 0) >= 2
            or confidence_stats.get("opinion_chars", 0) >= 5000
        )

        rt_audience_score = rating_context["rt_audience_score"]
        rt_audience_votes = rating_context["rt_audience_votes"]
        audience_loves_it = (
            rt_audience_score is not None
            and rt_audience_score >= 70
            and rt_audience_votes is not None
            and rt_audience_votes > 100
        )

        if (
            override_score is not None
            and 6.0 <= override_score < 7.0
            and override_votes is not None
            and override_votes > 500
            and llm_output.verdict == "WORTH IT"
            and (not llm_output.positive_pct or llm_output.positive_pct < 75)
            and not audience_loves_it
            and not has_strong_data
        ):
            logger.info(
                f"⚖️ Mid-Score Calibration: {title} "
                f"({score_source} {override_score}, {override_votes} votes, "
                f"positive {llm_output.positive_pct}%, "
                f"articles {confidence_stats['articles_read']}, "
                f"reddit {confidence_stats.get('reddit_sources', 0)}, "
                f"RT audience {rt_audience_score if rt_audience_score is not None else 'N/A'}%) "
                f"WORTH IT → MIXED BAG (thin data, trusting IMDb)"
            )
            llm_output.verdict = "MIXED BAG"

        
        # LOW confidence + low data should not give definitive WORTH IT
        # BUT respect strong IMDb signals — niche/international titles
        # may lack English articles but have real crowd consensus
        if confidence_stats["confidence_tier"] == "LOW" and llm_output.verdict == "WORTH IT":
            if confidence_stats["articles_read"] < 3:
                # Thin SCRAPED data — but a strong critic/audience consensus across ANY
                # major source is itself reliable signal. Don't downgrade a movie the
                # critics + crowd clearly love just because our scrapers came up short.
                rt_critic = rating_context["rt_critic_score"]
                rt_aud = rating_context["rt_audience_score"]
                rt_aud_votes = rating_context["rt_audience_votes"]
                meta = rating_context["metascore"]
                letterboxd = rating_context["letterboxd_score"]

                # Release-aware IMDb vote floor — brand-new movies haven't accrued
                # votes yet (1,000 is unfair to a film that's only weeks old).
                imdb_vote_floor = 1000
                if movie.release_date:
                    days_old = (date.today() - movie.release_date).days
                    if days_old <= 30:
                        imdb_vote_floor = 300
                    elif days_old <= 90:
                        imdb_vote_floor = 500

                has_strong_consensus = (
                    (imdb_score is not None and imdb_score >= 7.0
                     and imdb_votes is not None and imdb_votes >= imdb_vote_floor)
                    or (rt_critic is not None and rt_critic >= 75)
                    or (meta is not None and meta >= 70)
                    or (rt_aud is not None and rt_aud >= 75
                        and rt_aud_votes is not None and rt_aud_votes > 100)
                    or (letterboxd is not None and letterboxd >= 3.8)
                )
                if has_strong_consensus:
                    logger.info(
                        f"✅ LOW confidence but strong rating consensus: {title} "
                        f"(IMDb {imdb_score}/{imdb_votes}v floor {imdb_vote_floor}, "
                        f"RT {rt_critic}, Meta {meta}, LB {letterboxd}) "
                        f"— keeping WORTH IT despite only {confidence_stats['articles_read']} articles"
                    )
                else:
                    logger.info(
                        f"⚖️ Verdict override: WORTH IT → MIXED BAG "
                        f"(LOW confidence, only {confidence_stats['articles_read']} articles, "
                        f"no strong rating consensus — IMDb {imdb_score if imdb_score is not None else 'N/A'}/"
                        f"{imdb_votes or 0}v, RT {rt_critic}, Meta {meta}, LB {letterboxd})"
                    )
                    llm_output.verdict = "MIXED BAG"
        
        # Override confidence with our calculated value (not LLM's guess)
        llm_output.confidence = confidence_stats["confidence_tier"]

        # Hook-verdict consistency repair: if the hook contradicts the verdict, swap it
        _NEGATIVE_HOOK_WORDS = {
            "forgettable", "predictable", "disappointing", "mediocre", "bland",
            "underwhelming", "lackluster", "struggles", "fails", "flat",
            "generic", "uninspired", "boring", "dull", "skip",
        }
        _POSITIVE_HOOK_WORDS = {
            "masterpiece", "must-see", "must see", "brilliant", "stunning",
            "flawless", "perfect", "phenomenal", "extraordinary",
        }
        if llm_output.hook:
            hook_lower = llm_output.hook.lower()
            contradicts = False
            if llm_output.verdict == "WORTH IT" and any(w in hook_lower for w in _NEGATIVE_HOOK_WORDS):
                contradicts = True
            elif llm_output.verdict == "NOT WORTH IT" and any(w in hook_lower for w in _POSITIVE_HOOK_WORDS):
                contradicts = True

            if contradicts:
                fallback = llm_output.vibe or (llm_output.praise_points[0] if llm_output.praise_points else None)
                if fallback:
                    logger.info(f"🔄 Hook repair: \"{llm_output.hook}\" → \"{fallback}\" (contradicted {llm_output.verdict})")
                    llm_output.hook = fallback

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
        
        # Save Verdict DNA
        existing.tags = llm_output.tags
        existing.best_quote = llm_output.best_quote
        existing.quote_source = llm_output.quote_source
        
        # Save Review Voice & Critics vs Reddit
        existing.hook = llm_output.hook
        # Removed text fields merged into review text
        # existing.who_should_watch = llm_output.who_should_watch
        # existing.who_should_skip = llm_output.who_should_skip
        
        # existing.critic_sentiment = llm_output.criticism_points # OLD BUG
        existing.critic_sentiment = llm_output.critic_sentiment
        existing.reddit_sentiment = llm_output.reddit_sentiment
        # existing.critics_agree_with_reddit = llm_output.critics_agree_with_reddit
        # existing.tension_point = llm_output.tension_point
        
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
            
            # Save Verdict DNA
            tags=llm_output.tags,
            best_quote=llm_output.best_quote,
            quote_source=llm_output.quote_source,
            
            # Save Review Voice & Critics vs Reddit
            hook=llm_output.hook,
            # who_should_watch=llm_output.who_should_watch,
            # who_should_skip=llm_output.who_should_skip,
            critic_sentiment=llm_output.critic_sentiment,
            reddit_sentiment=llm_output.reddit_sentiment,
            # critics_agree_with_reddit=llm_output.critics_agree_with_reddit,
            # tension_point=llm_output.tension_point,
            
            sources_count=len(selected_urls),
            sources_urls=selected_urls,
            llm_model=llm_model,
        )
        db.add(review)
    
    await db.flush()
    
    # ─── Step 6: ENRICH (Phase 2) ─────────────────────────
    job_progress[tmdb_id] = "Finalizing your review..."
    
    # Trailer was already fetched in Step 1 parallel search
    if trailer_url:
        logger.info(f"🎬 Trailer already fetched: {trailer_url}")
    else:
        logger.info(f"🎬 No trailer found in Step 1 (or failed)")
        
    rating_context = _resolve_rating_context(movie, omdb_data, mdblist_scores)
    _apply_review_enrichment(review, rating_context, omdb_data, mdblist_scores)
    
    # Apply trailer
    if not isinstance(trailer_url, Exception) and trailer_url:
        review.trailer_url = trailer_url
    
    try:
        # Apply sentiment from LLM output
        review.positive_pct = llm_output.positive_pct
        review.negative_pct = llm_output.negative_pct
        review.mixed_pct = llm_output.mixed_pct
        review.last_refreshed_at = datetime.utcnow()
        
        await db.flush()
    except Exception as e:
        logger.warning(f"Final flush failed: {e}")
    
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


async def _create_fallback_review(
    db: AsyncSession,
    movie: Movie,
    genres: str,
    omdb_data: Optional[OMDBScores] = None,
    mdblist_scores: Optional[MDBListScores] = None,
) -> Review:
    """Create a low-confidence review when no sources are found."""
    rating_context = _resolve_rating_context(movie, omdb_data, mdblist_scores)
    llm_output = await synthesize_review(
        title=movie.title,
        year=str(movie.release_date.year) if movie.release_date else "",
        genres=genres,
        overview=movie.overview or "",
        opinions="Very limited crowd discussion found for this title. Base your review on the movie description and any general knowledge you have.",
        sources_count=0,
        tmdb_score=rating_context["tmdb_score"],
        tmdb_vote_count=rating_context["tmdb_votes"],
        imdb_score=rating_context["imdb_score"],
        imdb_votes=rating_context["imdb_votes"],
        rt_critic_score=rating_context["rt_critic_score"],
        rt_critic_votes=rating_context["rt_critic_votes"],
        rt_audience_score=rating_context["rt_audience_score"],
        rt_audience_votes=rating_context["rt_audience_votes"],
        metascore=rating_context["metascore"],
        metascore_votes=rating_context["metascore_votes"],
        metacritic_user_score=rating_context["metacritic_user_score"],
        metacritic_user_votes=rating_context["metacritic_user_votes"],
        letterboxd_score=rating_context["letterboxd_score"],
        letterboxd_votes=rating_context["letterboxd_votes"],
        trakt_score=rating_context["trakt_score"],
        trakt_votes=rating_context["trakt_votes"],
        rogerebert_score=rating_context["rogerebert_score"],
        confidence_tier="LOW",
        articles_read=0,
        reddit_sources=0,
        media_type=movie.media_type or "movie",
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
        hook=llm_output.hook,
        tags=llm_output.tags,
        critic_sentiment=llm_output.critic_sentiment,
        reddit_sentiment=llm_output.reddit_sentiment,
        positive_pct=llm_output.positive_pct,
        negative_pct=llm_output.negative_pct,
        mixed_pct=llm_output.mixed_pct,
        best_quote=llm_output.best_quote,
        quote_source=llm_output.quote_source,
    )
    _apply_review_enrichment(review, rating_context, omdb_data, mdblist_scores)
    db.add(review)
    await db.flush()
    return review
