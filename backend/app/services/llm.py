"""
Worth the Watch? — LLM Service
Supports DeepSeek and OpenAI with automatic failover.
Uses OpenAI SDK for both (DeepSeek is OpenAI-compatible).
"""

import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.schemas import LLMReviewOutput, ALLOWED_TAGS

settings = get_settings()
logger = logging.getLogger(__name__)

# ─── Client Configuration ─────────────────────────────────

def _build_deepseek_client():
    """Build DeepSeek client if API key exists."""
    if settings.DEEPSEEK_API_KEY:
        return (
            AsyncOpenAI(
                base_url="https://api.deepseek.com/v1",
                api_key=settings.DEEPSEEK_API_KEY,
            ),
            "deepseek-chat",
        )
    return None, None


def _build_openai_client():
    """Build OpenAI client if API key exists."""
    if settings.OPENAI_API_KEY:
        return (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY),
            "gpt-4o-mini",
        )
    return None, None


# Build both clients at startup
deepseek_client, deepseek_model = _build_deepseek_client()
openai_client, openai_model = _build_openai_client()

# Primary client based on config
if settings.LLM_PROVIDER == "openai" and openai_client:
    llm_client, llm_model = openai_client, openai_model
elif deepseek_client:
    llm_client, llm_model = deepseek_client, deepseek_model
elif openai_client:
    llm_client, llm_model = openai_client, openai_model
else:
    # Fallback: dummy client that will fail with clear error
    llm_client = AsyncOpenAI(
        base_url="https://api.deepseek.com/v1",
        api_key="missing-key-set-DEEPSEEK_API_KEY-or-OPENAI_API_KEY-in-env",
    )
    llm_model = "deepseek-chat"


# ─── System Prompt ─────────────────────────────────────────

SYSTEM_PROMPT = """You are the voice of "Worth the Watch?" — a genre-savvy entertainment guide that helps people decide what to watch. You are NOT a snobby film critic. You are a helpful guide who judges movies based on what they are trying to be.

Your job: Read the opinions gathered from articles and Reddit about a movie/show, then write a review that captures what the internet ACTUALLY thinks.

INPUT ORDER = PRIORITY:
1. AUDIENCE REACTIONS (Reddit/Forums) - Base your VERDICT mostly on this. This is the "Voice of the People".
2. CRITICAL CONTEXT (Professionals) - Use this for craft analysis, but if they disagree with Reddit, Reddit wins.

GENRE RELATIVITY (CRITICAL):
- Judge a movie by its goal. If it's a dumb fun action movie and it succeeds at being fun, that is WORTH IT.
- Do not punish "Popcorn Movies" for not being "High Art".
- If Reddit says "turn your brain off and enjoy it," that is a positive recommendation.

VERDICT RULES:

WORTH IT: 
- Use if >65% of audience opinions are positive.
- OR if the movie is widely described as "fun," "entertaining," "a blast," or "highly recommended" by the target audience.
- Flaws in plot or depth do NOT disqualify a movie from being WORTH IT if it succeeds at being entertaining.

MIXED BAG: Use ONLY if there is a genuine conflict:
- "Critics loved it, Audiences hated it" (or vice versa).
- "Great visuals, terrible script" (where the bad script ruins the fun).
- The audience is truly split 50/50.
- Do NOT use this just because a good movie has minor flaws. Most movies have flaws.

NOT WORTH IT: 
- Consensus is that it's boring, broken, or a waste of time.
- Even a "popcorn movie" can be NOT WORTH IT if it fails to be entertaining (e.g. "I expected nothing and was still disappointed").

CALIBRATION:
- Judge each movie on its own merits based on the actual opinions.
- No quotas. No targets. 
- If 90% of movies are fun and worth watching, then give 90% WORTH IT. We trust the internet.

HIGH SCORE PRIVILEGE (CRITICAL):
- If the TMDB User Rating is > 8.0, this is a MASTERPIECE.
- You MUST default to "WORTH IT" for any score > 8.0 unless there is a catastrophic, well-documented reason not to.
- Do NOT nitpick high-scoring movies. "Interstellar" (8.5) is WORTH IT. "The Dark Knight" (8.5) is WORTH IT.
- If the score is high but reviews are mixed, assume the reviews are the minority opinion and trust the score.

RULES:
- Write in a conversational, opinionated voice. Like a friend who watched it.
- NEVER include spoilers. 
- Be specific — reference general sentiment patterns.
- End with a clear verdict: WORTH IT, NOT WORTH IT, or MIXED BAG.
- Keep it 150-250 words. Punchy, not rambling.
- NEVER include numbers about confidence scores, source counts, or data quality metrics in your review text. These are internal metrics, not user-facing information.

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "review_text": "Your review here...",
  "verdict": "WORTH IT" | "NOT WORTH IT" | "MIXED BAG",
  "praise_points": ["point 1", "point 2", "point 3"],
  "criticism_points": ["point 1", "point 2"],
  "vibe": "one-line vibe description",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "positive_pct": 70,
  "negative_pct": 20,
  "mixed_pct": 10
}

SENTIMENT BREAKDOWN RULES:
- positive_pct + negative_pct + mixed_pct MUST equal 100.
- Base these on the actual distribution of opinions you analyzed.
- 70/20/10 is an example — use the real proportions from the sources."""


# ─── Synthesis Function ───────────────────────────────────

async def _call_llm(client: AsyncOpenAI, model: str, user_prompt: str) -> str:
    """Make LLM API call and return raw content with increased timeout."""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=800,
        timeout=60.0,  # Increased timeout for slow LLM responses
    )
    return response.choices[0].message.content


async def synthesize_review(
    title: str,
    year: str,
    genres: str,
    overview: str,
    opinions: str,
    sources_count: int,
    tmdb_score: float = 0.0,
    tmdb_vote_count: int = 0,
    imdb_score: float = None,
    imdb_votes: int = None,
    confidence_tier: str = "MEDIUM",
    articles_read: int = 0,
    reddit_sources: int = 0,
) -> LLMReviewOutput:
    """Generate a review with automatic LLM failover."""

    # Build data context instructions based on confidence
    if confidence_tier == "LOW":
        data_context = f"""
📊 You have {articles_read} sources and {reddit_sources} Reddit discussions.
CRITICAL RULES FOR THIS REVIEW:
- Write a confident, helpful review based on what you have.
- Do NOT mention limited data, thin coverage, or early buzz.
- Do NOT say "based on limited reviews" or "from what we could find."
- Do NOT say "early buzz suggests" even if the movie is new.
- Do NOT use any hedging language about data quality or source counts.
- Do NOT include any numbers about confidence scores or source counts in the review text.
- Write as if you have full context.
- If opinions lean positive, say so confidently. 
- If mixed, say so clearly.
- The user must never know how many sources you read."""

    elif confidence_tier == "MEDIUM":
        data_context = f"""
📊 You have {articles_read} sources and {reddit_sources} Reddit discussions.
RULES:
- Write a confident review based on the opinions below.
- Do NOT mention data quality, source counts, or coverage gaps.
- Do NOT include any numbers about confidence or sources in the review.
- Write authoritatively — "The internet's verdict is..."."""

    else:  # HIGH
        data_context = f"""
✅ Strong data: {articles_read} sources, {reddit_sources} from Reddit.
RULES:
- Speak with full authority — the internet has spoken.
- Do NOT mention source counts in the review text."""

    
    if imdb_score:
        score_context = f"IMDb Rating: {imdb_score}/10 based on {imdb_votes or 'N/A'} votes (IMDb is highly trusted, use this as a strong signal)"
        if tmdb_score:
            score_context += f"\nTMDB User Rating: {tmdb_score}/10 (for reference)"
    else:
        score_context = f"TMDB User Rating: {tmdb_score}/10 (based on {tmdb_vote_count} votes)"

    user_prompt = f"""Movie/Show: {title} ({year})
Genre: {genres}
{score_context}
Description: {overview}

{data_context}

Opinions gathered from {sources_count} sources across the internet:

{opinions}

Write your "Worth the Watch?" review based on these real internet opinions.

MANDATORY INSTRUCTIONS:
1. Select 3-5 tags STRICTLY from this list: {', '.join(sorted(ALLOWED_TAGS))}. Do not invent new tags.
2. Extract the single most memorable, funny, or insightful quote from the opinions.
3. Be specific in praise/criticism."""

    content = None
    used_model = None

    # Try primary LLM
    try:
        logger.info(f"🧠 Trying primary LLM: {llm_model}")
        content = await _call_llm(llm_client, llm_model, user_prompt)
        used_model = llm_model
    except Exception as e:
        logger.warning(f"Primary LLM ({llm_model}) failed: {e}")
        
        # Try fallback LLM
        fallback_client = openai_client if llm_client != openai_client else deepseek_client
        fallback_model = openai_model if llm_client != openai_client else deepseek_model
        
        if fallback_client:
            try:
                logger.info(f"🔄 Falling back to: {fallback_model}")
                content = await _call_llm(fallback_client, fallback_model, user_prompt)
                used_model = fallback_model
            except Exception as fallback_error:
                logger.error(f"Fallback LLM ({fallback_model}) also failed: {fallback_error}")
                raise RuntimeError(
                    f"All LLMs failed. Primary: {e}, Fallback: {fallback_error}"
                )
        else:
            raise RuntimeError(f"Primary LLM failed and no fallback available: {e}")

    logger.info(f"✅ Review generated using {used_model}")

    # Parse and validate JSON
    try:
        data = json.loads(content)
        return LLMReviewOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
        # Fallback: try to extract what we can
        logger.warning(f"JSON parsing failed: {e}")
        return LLMReviewOutput(
            review_text=content if isinstance(content, str) else "Review generation failed.",
            verdict="MIXED BAG",
            praise_points=[],
            criticism_points=[],
            vibe="Unable to determine",
            confidence="LOW",
        )

