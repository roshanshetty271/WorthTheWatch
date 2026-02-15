"""
Worth the Watch? — Versus Router
AI-powered 1v1 movie battles with witty comparisons.
"""

import json
import logging
from fastapi import APIRouter, Depends, Request, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Movie, Review, BattleCache
from app.services.tmdb import tmdb_service
from app.middleware.rate_limit import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Battle Prompt ────────────────────────────────────────

VERSUS_SYSTEM_PROMPT = """You are the MOVIE BATTLE HOST for "Worth the Watch?" — a fast, punchy, game-show-style commentator who crowns winners with flair.

Two movies enter. One wins. You deliver the verdict like a fight announcer — sharp, specific, entertaining.

YOUR STYLE:
- Think video game victory screen, NOT film review blog
- Every line should be SHORT and PUNCHY — like a scoreboard stat
- You are witty and confident. You commit to your pick
- You respect both movies but you are DECISIVE about the winner

THE KILL REASON — ONE quotable sentence:
- This is the headline. The tweet. The text you send your friends.
- It should be clever, specific, and reference BOTH movies
- It should make people smile and nod
- GREAT: "Shrek wins because it turned fairytale tropes inside out while Incredibles was too busy being an anxiety attack in spandex"
- GREAT: "Spider-Verse wins because it made every frame a comic book painting while Dark Knight was still figuring out how to light a room"

WINNER REASONS — exactly 3 short, punchy bullet points:
- Each one is a QUICK HIT — 4-8 words max
- Think scoreboard stats, not sentences
- Be specific: name characters, scenes, moments
- GREAT: "Donkey + Shrek = comedy gold"
- GREAT: "Animation that reinvented the genre"
- BAD: "It has better cinematography and stronger performances" (too generic)

LOSER REASONS — exactly 3 short, respectful bullet points:
- Explain what held it back IN THIS MATCHUP (not why it is bad)
- Stay respectful — these are good movies that just lost this round
- GREAT: "Syndrome's plan needed 20 more minutes"
- GREAT: "Too serious for a popcorn night pick"
- BAD: "It is a terrible movie" (NEVER say this)

ABSOLUTE RULES:
- Pick a winner. No ties. COMMIT.
- NEVER insult or demean a movie
- Be specific — name characters, scenes, actors
- Keep bullet points SHORT. 4-8 words each. NO SENTENCES.
- Every line should feel fun to read

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "winner": "a" or "b",
  "kill_reason": "ONE clever, quotable sentence.",
  "winner_reasons": ["reason 1", "reason 2", "reason 3"],
  "loser_reasons": ["reason 1", "reason 2", "reason 3"],
  "winner_headline": "2-4 celebratory words (e.g. 'Flawless Victory', 'Takes The Crown')",
  "loser_headline": "2-4 respectful words (e.g. 'Still A Classic', 'A Worthy Rival')"
}"""


# ─── Helper Functions ─────────────────────────────────────

def _build_movie_context(movie_data: dict, review_data: dict | None, label: str) -> str:
    """Build a rich context string for one movie."""
    title = movie_data.get("title", "Unknown")
    year = ""
    release = movie_data.get("release_date")
    if release:
        year = str(release)[:4] if isinstance(release, str) else str(release.year) if hasattr(release, "year") else ""
    
    genres = ""
    raw_genres = movie_data.get("genres")
    if raw_genres and isinstance(raw_genres, list):
        genre_names = [g.get("name", "") for g in raw_genres if isinstance(g, dict) and g.get("name")]
        genres = ", ".join(genre_names)
    
    overview = movie_data.get("overview", "No overview available.")
    
    context = f"""MOVIE {label}: {title} ({year})
Genre: {genres}
Overview: {overview}"""
    
    if review_data:
        verdict = review_data.get("verdict", "")
        hook = review_data.get("hook", "")
        imdb = review_data.get("imdb_score")
        rt = review_data.get("rt_critic_score")
        review_text = review_data.get("review_text", "")
        
        context += f"\nOur Verdict: {verdict}"
        if hook:
            context += f"\nHook: {hook}"
        if imdb:
            context += f"\nIMDb: {imdb}/10"
        if rt:
            context += f"\nRotten Tomatoes: {rt}%"
        if review_text:
            context += f"\nReview excerpt: {review_text[:500]}"
    else:
        tmdb_score = movie_data.get("tmdb_vote_average")
        if tmdb_score:
            context += f"\nTMDB Score: {tmdb_score}/10"
        context += "\n(No detailed review available — use your knowledge of this film)"
    
    return context


async def _get_movie_data(db: AsyncSession, tmdb_id: int, media_type: str = "movie") -> tuple[dict, dict | None]:
    """
    Fetch movie data + review from DB. If not in DB, fetch from TMDB.
    Uses media_type to query the correct TMDB endpoint (movie vs tv).
    This prevents TMDB ID collisions (e.g. Doraemon TV #57911 vs Harry and the Butler movie #57911).
    Returns (movie_data_dict, review_data_dict_or_None)
    """
    # Try DB first — filter by media_type to avoid collisions
    result = await db.execute(
        select(Movie).options(joinedload(Movie.review)).where(
            Movie.tmdb_id == tmdb_id,
            Movie.media_type == media_type,
        )
    )
    movie = result.unique().scalar_one_or_none()
    
    # Fallback: try DB without media_type filter (in case it was stored differently)
    if not movie:
        result = await db.execute(
            select(Movie).options(joinedload(Movie.review)).where(Movie.tmdb_id == tmdb_id)
        )
        movies = result.unique().scalars().all()
        if movies:
            # Prefer the one with a review
            reviewed = [m for m in movies if m.review]
            movie = reviewed[0] if reviewed else movies[0]
    
    if movie:
        movie_data = {
            "title": movie.title,
            "release_date": movie.release_date,
            "genres": movie.genres,
            "overview": movie.overview,
            "poster_path": movie.poster_path,
            "backdrop_path": movie.backdrop_path,
            "tmdb_vote_average": movie.tmdb_vote_average,
            "media_type": movie.media_type,
        }
        review_data = None
        if movie.review:
            review_data = {
                "verdict": movie.review.verdict,
                "hook": movie.review.hook,
                "review_text": movie.review.review_text,
                "imdb_score": movie.review.imdb_score,
                "rt_critic_score": movie.review.rt_critic_score,
            }
        return movie_data, review_data
    
    # Not in DB — fetch from TMDB using the correct type FIRST
    tmdb_data = None
    if media_type == "tv":
        tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
        if not tmdb_data or not tmdb_data.get("id"):
            tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
    else:
        tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
        if not tmdb_data or not tmdb_data.get("id"):
            tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
    
    if not tmdb_data or not tmdb_data.get("id"):
        return {}, None
    
    normalized = tmdb_service.normalize_result({**tmdb_data, "media_type": media_type})
    return normalized, None


# ─── Battle Endpoint ──────────────────────────────────────

@router.post("/battle")
async def battle(
    movie_a_id: int = Query(..., description="TMDB ID of movie A"),
    movie_b_id: int = Query(..., description="TMDB ID of movie B"),
    movie_a_type: str = Query("movie", pattern="^(movie|tv)$", description="Media type of movie A"),
    movie_b_type: str = Query("movie", pattern="^(movie|tv)$", description="Media type of movie B"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an AI-powered 1v1 movie battle with witty comparison.
    Returns a winner with a 'kill reason' and breakdown.
    Results are cached in PostgreSQL for repeat battles.
    
    IMPORTANT: movie_a_type and movie_b_type are required to avoid TMDB ID
    collisions. TMDB uses separate ID namespaces for movies and TV shows,
    so tmdb_id 57911 could be both a movie and a TV show.
    """
    if movie_a_id == movie_b_id and movie_a_type == movie_b_type:
        raise HTTPException(status_code=400, detail="Cannot battle a movie against itself")
    
    # Rate limit (same as review generation)
    await check_rate_limit(request, is_generation=True)
    
    logger.info(f"⚔️ Versus battle: {movie_a_id} ({movie_a_type}) vs {movie_b_id} ({movie_b_type})")
    
    # ── Check cache first ──
    # Include media types in cache key to differentiate TV vs movie with same ID
    cache_key_a = f"{min(movie_a_id, movie_b_id)}"
    cache_key_b = f"{max(movie_a_id, movie_b_id)}"
    cache_a = min(movie_a_id, movie_b_id)
    cache_b = max(movie_a_id, movie_b_id)
    
    cached = await db.execute(
        select(BattleCache).where(
            BattleCache.movie_a_id == cache_a,
            BattleCache.movie_b_id == cache_b,
        )
    )
    cached_battle = cached.scalar_one_or_none()
    
    if cached_battle and cached_battle.result_json:
        logger.info(f"⚡ Cache hit for battle: {movie_a_id} vs {movie_b_id}")
        return cached_battle.result_json
    
    # ── Fetch both movies' data with correct media types ──
    movie_a_data, review_a = await _get_movie_data(db, movie_a_id, movie_a_type)
    movie_b_data, review_b = await _get_movie_data(db, movie_b_id, movie_b_type)
    
    if not movie_a_data.get("title") or not movie_b_data.get("title"):
        raise HTTPException(status_code=404, detail="One or both movies not found")
    
    # Build context for LLM
    context_a = _build_movie_context(movie_a_data, review_a, "A")
    context_b = _build_movie_context(movie_b_data, review_b, "B")
    
    user_prompt = f"""{context_a}

{context_b}

These two titles are going head-to-head. Analyze everything — story, performances, cultural impact, scores, audience reception — and crown a winner.

Remember: The kill_reason needs to be ONE sentence so clever and funny that people will screenshot it. Reference something specific about BOTH movies."""
    
    # Call LLM
    from openai import AsyncOpenAI
    from app.services.llm import llm_client, llm_model, openai_client, openai_model, deepseek_client, deepseek_model, sanitize_text
    
    content = None
    used_model = llm_model
    try:
        logger.info(f"🧠 Versus LLM call: {llm_model}")
        response = await llm_client.chat.completions.create(
            model=llm_model,
            messages=[
                {"role": "system", "content": VERSUS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=500,
            timeout=30.0,
        )
        content = response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Primary LLM failed for versus: {e}")
        fallback_client = openai_client if llm_client != openai_client else deepseek_client
        fallback_model = openai_model if llm_client != openai_client else deepseek_model
        
        if fallback_client:
            try:
                used_model = fallback_model
                response = await fallback_client.chat.completions.create(
                    model=fallback_model,
                    messages=[
                        {"role": "system", "content": VERSUS_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.7,
                    max_tokens=500,
                    timeout=30.0,
                )
                content = response.choices[0].message.content
            except Exception as fallback_error:
                logger.error(f"Fallback LLM also failed for versus: {fallback_error}")
                raise HTTPException(status_code=503, detail="AI battle generation failed")
        else:
            raise HTTPException(status_code=503, detail="AI battle generation failed")
    
    # Parse response
    try:
        data = json.loads(content)
        
        winner_id = movie_a_id if data.get("winner") == "a" else movie_b_id
        loser_id = movie_b_id if winner_id == movie_a_id else movie_a_id
        winner_data = movie_a_data if winner_id == movie_a_id else movie_b_data
        loser_data = movie_b_data if winner_id == movie_a_id else movie_a_data
        winner_type = movie_a_type if winner_id == movie_a_id else movie_b_type
        loser_type = movie_b_type if winner_id == movie_a_id else movie_a_type
        
        result = {
            "winner_id": winner_id,
            "loser_id": loser_id,
            "winner_title": winner_data.get("title", ""),
            "loser_title": loser_data.get("title", ""),
            "kill_reason": sanitize_text(data.get("kill_reason", "")),
            "winner_reasons": [sanitize_text(r) for r in data.get("winner_reasons", [])],
            "loser_reasons": [sanitize_text(r) for r in data.get("loser_reasons", [])],
            "breakdown": sanitize_text(data.get("breakdown", "")),
            "winner_headline": data.get("winner_headline", "The Winner"),
            "loser_headline": data.get("loser_headline", "Good Try"),
            "movie_a": {
                "tmdb_id": movie_a_id,
                "title": movie_a_data.get("title", ""),
                "poster_path": movie_a_data.get("poster_path"),
                "backdrop_path": movie_a_data.get("backdrop_path"),
                "release_date": str(movie_a_data.get("release_date", "")),
                "tmdb_vote_average": movie_a_data.get("tmdb_vote_average"),
                "media_type": movie_a_type,
                "verdict": review_a.get("verdict") if review_a else None,
                "imdb_score": review_a.get("imdb_score") if review_a else None,
            },
            "movie_b": {
                "tmdb_id": movie_b_id,
                "title": movie_b_data.get("title", ""),
                "poster_path": movie_b_data.get("poster_path"),
                "backdrop_path": movie_b_data.get("backdrop_path"),
                "release_date": str(movie_b_data.get("release_date", "")),
                "tmdb_vote_average": movie_b_data.get("tmdb_vote_average"),
                "media_type": movie_b_type,
                "verdict": review_b.get("verdict") if review_b else None,
                "imdb_score": review_b.get("imdb_score") if review_b else None,
            },
        }
        
        # ── Save to cache ──
        try:
            new_cache = BattleCache(
                movie_a_id=cache_a,
                movie_b_id=cache_b,
                winner_id=winner_id,
                loser_id=loser_id,
                winner_title=result["winner_title"],
                loser_title=result["loser_title"],
                kill_reason=result["kill_reason"],
                breakdown=result["breakdown"],
                winner_headline=result["winner_headline"],
                loser_headline=result["loser_headline"],
                result_json=result,
                llm_model=used_model,
            )
            db.add(new_cache)
            await db.commit()
            logger.info(f"💾 Cached battle: {cache_a} vs {cache_b}")
        except Exception as cache_err:
            logger.warning(f"Failed to cache battle result: {cache_err}")
            await db.rollback()
        
        logger.info(f"⚔️ Battle result: {winner_data.get('title')} defeats {loser_data.get('title')}")
        return result
        
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to parse versus result: {e}")
        raise HTTPException(status_code=500, detail="Battle result parsing failed")