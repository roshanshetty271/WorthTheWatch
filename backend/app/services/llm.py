"""
Worth the Watch? — LLM Service
Swappable between DeepSeek and GPT-4o mini via LLM_PROVIDER env var.
Uses OpenAI SDK for both (DeepSeek is OpenAI-compatible).
"""

import json
from openai import AsyncOpenAI
from app.config import get_settings
from app.schemas import LLMReviewOutput

settings = get_settings()

# ─── Client Configuration ─────────────────────────────────

def _build_clients():
    """Build LLM clients lazily. Returns (client, model) tuple."""
    provider = settings.LLM_PROVIDER

    if provider == "openai" and settings.OPENAI_API_KEY:
        return (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY),
            "gpt-4o-mini",
        )

    # Default to DeepSeek
    if settings.DEEPSEEK_API_KEY:
        return (
            AsyncOpenAI(
                base_url="https://api.deepseek.com/v1",
                api_key=settings.DEEPSEEK_API_KEY,
            ),
            "deepseek-chat",
        )

    # Fallback: create a dummy client that will fail with a clear error
    # This allows the app to start even without keys (for frontend-only dev)
    return (
        AsyncOpenAI(
            base_url="https://api.deepseek.com/v1",
            api_key="missing-key-set-DEEPSEEK_API_KEY-in-env",
        ),
        "deepseek-chat",
    )


llm_client, llm_model = _build_clients()

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

async def synthesize_review(
    title: str,
    year: str,
    genres: str,
    overview: str,
    opinions: str,
    sources_count: int,
) -> LLMReviewOutput:
    """Generate a review from filtered opinion text."""

    user_prompt = f"""Movie/Show: {title} ({year})
Genre: {genres}
Description: {overview}

Opinions gathered from {sources_count} sources across the internet:

{opinions}

Write your "Worth the Watch?" review based on these real internet opinions."""

    response = await llm_client.chat.completions.create(
        model=llm_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=1000,
    )

    content = response.choices[0].message.content

    # Parse and validate JSON
    try:
        data = json.loads(content)
        return LLMReviewOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
        # Fallback: try to extract what we can
        return LLMReviewOutput(
            review_text=content if isinstance(content, str) else "Review generation failed.",
            verdict="MIXED BAG",
            praise_points=[],
            criticism_points=[],
            vibe="Unable to determine",
            confidence="LOW",
        )
