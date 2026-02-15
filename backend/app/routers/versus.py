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
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.middleware.rate_limit import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()


# ─── Battle Prompt ────────────────────────────────────────

VERSUS_SYSTEM_PROMPT = """You are the MOVIE BATTLE HOST for "Worth the Watch?" — a witty, cinema-obsessed commentator who pits two films against each other with clever, entertaining analysis.

Two movies enter. One wins. But BOTH are respected. You are funny and sharp, never cruel or dismissive.

YOUR PERSONA:
- A film-loving friend who can make any comparison entertaining and insightful
- You have STRONG opinions but you back them up with clever reasoning
- You are witty, not mean. Think entertaining podcast host, not internet troll
- You genuinely love movies and it shows — you never trash a movie people love

THE GOLDEN RULE:
Both movies deserve respect. The winner wins because of what makes it SPECIAL, not because the loser is bad. You can be playful and cheeky, but never cruel about beloved films.

GOOD TONE (study these):
- "Barbie wins because existential dread hits different in neon pink — Ken's journey from beach to patriarchy is genuinely one of the wildest character arcs of 2023. Oppenheimer brought the weight of history; Barbie made you feel it while wearing roller skates."
- "Spider-Verse wins because it proved animation can make your jaw drop AND your heart ache in the same frame. The Dark Knight set the gold standard for superhero gravitas — but Spider-Verse rewrote what the genre could even be."
- "Interstellar wins because it turned a physics lecture into the most emotional father-daughter story ever filmed, and that docking scene still makes people hold their breath on rewatch."

BAD TONE (NEVER do this):
- "Movie B is trash / garbage / unwatchable" (NEVER trash a movie)
- "Watching Movie B is like eating gas station sushi" (disrespectful to good films)
- "Movie B should be ashamed" (too harsh)
- Any comparison that implies the loser is a bad movie overall

THE KILL REASON — ONE sentence that captures WHY the winner takes it:
- Should be clever, quotable, and fun to read
- Celebrate what makes the winner special
- Can be playful about the matchup without insulting the loser
- Think: "This is what I would text my friends after a movie night debate"

THE BREAKDOWN — 3-5 sentences of entertaining, specific analysis:
- Reference specific characters, scenes, moments BY NAME
- Explain what gives the winner its edge — direction, emotion, craft, impact
- Acknowledge the loser's strengths while explaining why the winner edges ahead
- Be conversational and fun. Zero film-school jargon. Zero generic filler.
- End with a fun recommendation that respects both films

ABSOLUTE RULES:
- Pick a winner. No ties. No "both are great." COMMIT to a winner.
- NEVER insult or demean a movie — especially beloved classics
- Reference SPECIFIC characters, scenes, plot points, actors BY NAME
- Every sentence should be engaging and specific. Zero filler.
- If someone reads this and does not smile at least once, you have FAILED.

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "winner": "a" or "b",
  "kill_reason": "ONE clever, specific, quotable sentence explaining why the winner takes it.",
  "breakdown": "3-5 sentences of entertaining, specific analysis. Reference actual characters and scenes. Celebrate what makes the winner special.",
  "winner_headline": "2-4 celebratory words (e.g. 'Flawless Victory', 'The Clear Winner', 'Takes The Crown')",
  "loser_headline": "2-4 words of respectful consolation (e.g. 'Still A Classic', 'Close But No', 'A Worthy Rival')"
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
            # Include first 500 chars of review for context
            context += f"\nReview excerpt: {review_text[:500]}"
    else:
        tmdb_score = movie_data.get("tmdb_vote_average")
        if tmdb_score:
            context += f"\nTMDB Score: {tmdb_score}/10"
        context += "\n(No detailed review available — use your knowledge of this film)"
    
    return context


async def _get_movie_data(db: AsyncSession, tmdb_id: int) -> tuple[dict, dict | None]:
    """
    Fetch movie data + review from DB. If not in DB, fetch from TMDB.
    Returns (movie_data_dict, review_data_dict_or_None)
    """
    # Try DB first
    result = await db.execute(
        select(Movie).options(joinedload(Movie.review)).where(Movie.tmdb_id == tmdb_id)
    )
    movie = result.unique().scalar_one_or_none()
    
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
    
    # Not in DB — fetch from TMDB
    tmdb_data = await tmdb_service.get_movie_details(tmdb_id)
    if not tmdb_data or not tmdb_data.get("id"):
        # Try TV
        tmdb_data = await tmdb_service.get_tv_details(tmdb_id)
    
    if not tmdb_data or not tmdb_data.get("id"):
        return {}, None
    
    normalized = tmdb_service.normalize_result({**tmdb_data, "media_type": tmdb_data.get("media_type", "movie")})
    return normalized, None


# ─── Battle Endpoint ──────────────────────────────────────

@router.post("/battle")
async def battle(
    movie_a_id: int = Query(..., description="TMDB ID of movie A"),
    movie_b_id: int = Query(..., description="TMDB ID of movie B"),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an AI-powered 1v1 movie battle with witty comparison.
    Returns a winner with a devastating 'kill reason' and breakdown.
    """
    if movie_a_id == movie_b_id:
        raise HTTPException(status_code=400, detail="Cannot battle a movie against itself")
    
    # Rate limit (same as review generation)
    await check_rate_limit(request, is_generation=True)
    
    logger.info(f"⚔️ Versus battle: {movie_a_id} vs {movie_b_id}")
    
    # Fetch both movies' data in parallel
    movie_a_data, review_a = await _get_movie_data(db, movie_a_id)
    movie_b_data, review_b = await _get_movie_data(db, movie_b_id)
    
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
    try:
        logger.info(f"🧠 Versus LLM call: {llm_model}")
        response = await llm_client.chat.completions.create(
            model=llm_model,
            messages=[
                {"role": "system", "content": VERSUS_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,  # Higher temp for more creative/funny output
            max_tokens=500,
            timeout=30.0,
        )
        content = response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Primary LLM failed for versus: {e}")
        # Try fallback
        fallback_client = openai_client if llm_client != openai_client else deepseek_client
        fallback_model = openai_model if llm_client != openai_client else deepseek_model
        
        if fallback_client:
            try:
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
        
        result = {
            "winner_id": winner_id,
            "loser_id": loser_id,
            "winner_title": winner_data.get("title", ""),
            "loser_title": loser_data.get("title", ""),
            "kill_reason": sanitize_text(data.get("kill_reason", "")),
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
                "verdict": review_b.get("verdict") if review_b else None,
                "imdb_score": review_b.get("imdb_score") if review_b else None,
            },
        }
        
        logger.info(f"⚔️ Battle result: {winner_data.get('title')} defeats {loser_data.get('title')}")
        return result
        
    except (json.JSONDecodeError, Exception) as e:
        logger.error(f"Failed to parse versus result: {e}")
        raise HTTPException(status_code=500, detail="Battle result parsing failed")