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



def normalize_for_search(title: str) -> str:
    """Strip diacritical marks for search: Bāhubali → Bahubali, Amélie → Amelie"""
    nfkd = unicodedata.normalize('NFKD', title)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


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
        # Run ALL searches in parallel — Serper + Guardian + NYT
        logger.info(f"🚀 Step 1/4: Launching parallel searches for '{title}'...")
        search_results = await asyncio.gather(
            serper_service.search_reviews(search_title, year),
            serper_service.search_reddit(search_title, year),
            serper_service.search_forums(search_title, year),
            guardian_service.search_film_reviews(search_title, year),
            nyt_service.search_reviews(search_title),
            omdb_service.get_scores_by_title(search_title, year, "series" if movie.media_type == "tv" else "movie"),
            return_exceptions=True,
        )
        
        # Unpack results
        serper_critics = search_results[0] if not isinstance(search_results[0], Exception) else []
        serper_reddit = search_results[1] if not isinstance(search_results[1], Exception) else []
        serper_forums = search_results[2] if not isinstance(search_results[2], Exception) else []
        guardian_results = search_results[3] if not isinstance(search_results[3], Exception) else []
        nyt_results = search_results[4] if not isinstance(search_results[4], Exception) else []
        omdb_data = search_results[5] if not isinstance(search_results[5], Exception) else None

        # Extract IMDb score early for verdict overrides
        imdb_score = None
        imdb_votes = None
        if omdb_data:
            imdb_score = omdb_data.imdb_score
            imdb_votes = omdb_data.imdb_votes
            if imdb_score:
                logger.info(f"🎬 IMDb: {imdb_score}/10 ({imdb_votes or '?'} votes)")

        # Log failures
        if isinstance(search_results[0], Exception): logger.error(f"Critic search failed: {search_results[0]}")
        if isinstance(search_results[1], Exception): logger.error(f"Reddit search failed: {search_results[1]}")
        if isinstance(search_results[2], Exception): logger.error(f"Forum search failed: {search_results[2]}")
        if isinstance(search_results[3], Exception): logger.warning(f"Guardian search failed: {search_results[3]}")
        if isinstance(search_results[4], Exception): logger.warning(f"NYT search failed: {search_results[4]}")

        # Combine all results
        all_results = serper_critics + serper_reddit + serper_forums
        
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
        return await _create_fallback_review(db, movie, genres)

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
                reddit_snippets.append(f"Reddit ({result_title}):\n{snippet}")
    
    if reddit_snippets:
        logger.info(f"📋 Captured {len(reddit_snippets)} Reddit snippets from Serper")

    # ─── Step 2: READ ──────────────────────────────────────
    job_progress[tmdb_id] = "Gathering opinions..."
    
    # ─── STEP: Read articles ───
    articles, failed_urls = await jina_service.read_urls(selected_urls, max_concurrent=5)
    
    # ─── STEP: Smart backfill — only if we're short on data ───
    if len(articles) >= 5:
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
    job_progress[tmdb_id] = "Analyzing feedback..."
    logger.info(f"🔎 Step 3/4: Filtering opinions from {len(articles)} articles")
    
    # ─── STEP: Grep filter ONLY the scraped articles ───
    # Reddit snippets bypass grep — they're already pure opinion
    filtered_opinions = extract_opinion_paragraphs(articles)
    
    logger.info(
        f"🔍 FILTERED OPINIONS: {len(filtered_opinions)} chars "
        f"(from {total_chars} raw chars)"
    )
    
    # ─── STEP: Append Reddit snippets AFTER grep ───
    # This is critical — snippets must ALWAYS reach the LLM
    # They bypass grep because they're already opinion text
    snippet_text = ""
    if reddit_snippets:
        snippet_text = "\n\n".join(reddit_snippets[:10])
        filtered_opinions = (
            filtered_opinions 
            + "\n\n--- What Reddit Thinks ---\n\n" 
            + snippet_text
        )
        logger.info(
            f"💬 Appended {len(snippet_text)} chars of Reddit snippets "
            f"(bypassed grep — pure crowd opinion)"
        )
        logger.info(
            f"📊 TOTAL to LLM: {len(filtered_opinions)} chars "
            f"(filtered articles + Reddit snippets)"
        )

    # ─── STEP: Truncate to LLM limit ───
    # Make sure snippets don't get cut off by truncation
    # If we have to truncate, keep at least the snippet portion
    MAX_LLM_CHARS = 18000
    
    if len(filtered_opinions) > MAX_LLM_CHARS:
        if snippet_text:
            # Reserve space for snippets at the end
            snippet_reserve = min(len(snippet_text) + 50, 5000)
            article_limit = MAX_LLM_CHARS - snippet_reserve
            
            # Find where the snippet section starts
            snippet_marker = "--- What Reddit Thinks ---"
            marker_pos = filtered_opinions.find(snippet_marker)
            
            if marker_pos > 0:
                article_part = filtered_opinions[:marker_pos][:article_limit]
                snippet_part = filtered_opinions[marker_pos:][:snippet_reserve]
                filtered_opinions = article_part + "\n\n" + snippet_part
            else:
                filtered_opinions = filtered_opinions[:MAX_LLM_CHARS]
        else:
            filtered_opinions = filtered_opinions[:MAX_LLM_CHARS]
    
    logger.info(f"📨 Sending {len(filtered_opinions)} chars to LLM")

    if not filtered_opinions or len(filtered_opinions) < 50:
        # Use raw snippets as fallback
        filtered_opinions = "\n\n".join(
            f"{r['title']}: {r['snippet']}" for r in all_results[:15]
        )
        logger.info(f"   ⚠️ Using fallback snippets: {len(filtered_opinions)} chars")

    # ─── Step 4: SYNTHESIZE ────────────────────────────────
    job_progress[tmdb_id] = "Writing your verdict..."
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
        llm_output = await synthesize_review(
            title=title,
            year=year,
            genres=genres,
            overview=movie.overview or "",
            opinions=filtered_opinions, # Already truncated
            sources_count=len(articles),
            tmdb_score=movie.tmdb_vote_average or 0.0,
            tmdb_vote_count=movie.tmdb_vote_count or 0,
            imdb_score=imdb_score,
            imdb_votes=imdb_votes,
            confidence_tier=confidence_stats["confidence_tier"],
            articles_read=confidence_stats["articles_read"],
            reddit_sources=confidence_stats["reddit_sources"],
        )
        
        # Sanity check: verdict should match sentiment percentages
        if llm_output.positive_pct is not None and llm_output.negative_pct is not None:
            pos = llm_output.positive_pct
            neg = llm_output.negative_pct
            

            # High Score Privilege — crowd has spoken
            # Use IMDb if available (more reliable), else TMDB
            override_score = imdb_score if imdb_score else movie.tmdb_vote_average
            override_votes = imdb_votes if imdb_votes else (movie.tmdb_vote_count or 0)
            score_source = "IMDb" if imdb_score else "TMDB"

            logger.info(f"📊 Using {score_source} score for overrides: {override_score}/10 ({override_votes} votes)")

            if (
                override_score and override_score > 7.5
                and override_votes and override_votes > 500
                and llm_output.verdict != "WORTH IT"
            ):
                if llm_output.positive_pct and llm_output.positive_pct >= 45:
                    logger.info(
                        f"⭐ High Score Privilege: {movie.title} "
                        f"({score_source} {override_score}, {override_votes} votes) "
                        f"{llm_output.verdict} → WORTH IT"
                    )
                    llm_output.verdict = "WORTH IT"
                else:
                    # Edge case: high score but LLM found very negative articles
                    # Split the difference
                    logger.info(
                        f"⚠️ High Score Conflict: {movie.title} "
                        f"({score_source} {override_score} but only {llm_output.positive_pct}% positive) "
                        f"→ MIXED BAG"
                    )
                    llm_output.verdict = "MIXED BAG"
            
            # NOT WORTH IT requires strong negative signal (Relaxed cutoff)
            if llm_output.verdict == "NOT WORTH IT" and pos > 60:
                logger.info(f"⚖️ Verdict override: NOT WORTH IT → MIXED BAG (positive {pos}%)")
                llm_output.verdict = "MIXED BAG"
        
        # ─── Low Score Safety Net ───
        # If score is below 6.0 with decent vote count,
        # the movie is generally considered bad. The LLM should not 
        # give it WORTH IT unless the internet OVERWHELMINGLY disagrees.
        
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
            and llm_output.verdict == "WORTH IT"
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

        # LOW confidence + low data should not give definitive WORTH IT
        
        # LOW confidence + low data should not give definitive WORTH IT
        if confidence_stats["confidence_tier"] == "LOW" and llm_output.verdict == "WORTH IT":
            # Only override if critically low data (reduced from < 4 to < 3)
            if confidence_stats["articles_read"] < 3:
                logger.info(f"⚖️ Verdict override: WORTH IT → MIXED BAG (LOW confidence, only {confidence_stats['articles_read']} articles)")
                llm_output.verdict = "MIXED BAG"
        
        # Override confidence with our calculated value (not LLM's guess)
        llm_output.confidence = confidence_stats["confidence_tier"]

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
            
            sources_count=len(selected_urls),
            sources_urls=selected_urls,
            llm_model=llm_model,
        )
        db.add(review)
    
    await db.flush()
    
    # ─── Step 6: ENRICH (Phase 2) ─────────────────────────
    job_progress[tmdb_id] = "Finalizing your review..."
    logger.info(f"🎬 Step 5/5: Fetching trailer for '{title}' (OMDB already done)")
    
    try:
        # Step 5: Enrichment — only fetch trailer (OMDB already done)
        enrichment_results = await asyncio.gather(
            _get_best_trailer(movie.tmdb_id, movie.media_type or "movie"),
            return_exceptions=True,
        )
        
        trailer_url = enrichment_results[0] if not isinstance(enrichment_results[0], Exception) else None
        
        # Apply OMDB scores (using data fetched in Step 1)
        if omdb_data:
            review.imdb_score = omdb_data.imdb_score
            review.rt_critic_score = omdb_data.rt_critic_score
            review.metascore = omdb_data.metascore
            # Calculate controversial flag (RT critic vs audience gap > 25)
            # We can only do this if we have both, currently we might lack audience score
            if omdb_data.rt_critic_score and review.rt_audience_score:
                gap = abs(omdb_data.rt_critic_score - review.rt_audience_score)
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
