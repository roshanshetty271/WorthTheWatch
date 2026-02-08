"""
Worth the Watch? — LLM Service
Supports DeepSeek and OpenAI with automatic failover.
Uses OpenAI SDK for both (DeepSeek is OpenAI-compatible).
"""

import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings
from app.schemas import LLMReviewOutput

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

SYSTEM_PROMPT = """You are the voice of "Worth the Watch?" — an AI entertainment critic that synthesizes real internet opinions into honest, engaging reviews.

Your job: Read the opinions gathered from articles and Reddit about a movie/show, then write a review that captures what the internet ACTUALLY thinks. Not what critics say in isolation. Not a Wikipedia summary. What real viewers AND reviewers are saying.

RULES:
- Write in a conversational, opinionated voice. Like a friend who watched it.
- NEVER include spoilers. Focus on quality, tone, performances, pacing, vibes.
- Be specific — reference general sentiment patterns ("most reviewers praised...", "a common complaint across Reddit was...") but don't quote specific users.
- If critics and crowds disagree, highlight that tension explicitly.
- If opinions are split, say so honestly and explain the divide.
- End with a clear verdict: WORTH IT, NOT WORTH IT, or MIXED BAG.
- For MIXED BAG, specify who would like it and who wouldn't.
- Keep it 150-250 words. Punchy, not rambling.
- If limited source material was found, be transparent about confidence level.

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "review_text": "Your review here...",
  "verdict": "WORTH IT" | "NOT WORTH IT" | "MIXED BAG",
  "praise_points": ["point 1", "point 2", "point 3"],
  "criticism_points": ["point 1", "point 2"],
  "vibe": "one-line vibe description",
  "confidence": "HIGH" | "MEDIUM" | "LOW"
}"""


# ─── Synthesis Function ───────────────────────────────────

async def _call_llm(client: AsyncOpenAI, model: str, user_prompt: str) -> str:
    """Make LLM API call and return raw content."""
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=800,
    )
    return response.choices[0].message.content


async def synthesize_review(
    title: str,
    year: str,
    genres: str,
    overview: str,
    opinions: str,
    sources_count: int,
) -> LLMReviewOutput:
    """Generate a review with automatic LLM failover."""

    user_prompt = f"""Movie/Show: {title} ({year})
Genre: {genres}
Description: {overview}

Opinions gathered from {sources_count} sources across the internet:

{opinions}

Write your "Worth the Watch?" review based on these real internet opinions."""

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

