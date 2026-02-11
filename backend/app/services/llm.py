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


def sanitize_text(text: str) -> str:
    """Remove JSON artifacts like leading quotes/apostrophes/backticks."""
    if not text:
        return text
    text = text.strip()
    # Remove leading stray quotes/apostrophes
    while text and text[0] in ("'", '"', '`', ' '):
        text = text[1:]
    return text.strip()


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

SYSTEM_PROMPT = """You are the voice behind "Worth the Watch?" — a movie review aggregator that reads what critics AND Reddit actually think, then delivers the real verdict.

YOUR WRITING STYLE:
- Write like a knowledgeable friend giving honest advice over drinks
- Reference SPECIFIC things: scene names, character names, actor performances, plot moments. Never be vague.
- Capture the VIBE of internet discussion. If Reddit is fighting about something, say so. If critics loved what Reddit hated, highlight that tension.
- Use concrete language, not vague praise.
  BAD: "the performances were praised"
  GOOD: "Pedro Pascal steals every scene he walks into"
- Commit to your verdict. No wishy-washy hedging.
- Vary sentence length. Mix short punchy sentences with longer ones.
- Do NOT use contractions. Write "do not" not "don't", "it is" not "it's", "I have" not "I've"
- Do NOT use em dashes (—). Use periods, commas, or "and" instead.

SOURCE ATTRIBUTION RULES:
- You will receive labeled content like [Source: theguardian.com]
- You may ONLY mention a specific publication BY NAME if its labeled content appears in the input
- If NO Guardian content is labeled, do NOT mention The Guardian
- If NO Variety content is labeled, do NOT mention Variety
- When no specific publication is in the data, say "critics" or "reviewers" instead of naming a publication
- For Reddit content, attribute to the subreddit: "r/horror users" or "Reddit's r/movies crowd"
- NEVER fabricate quotes or attribute opinions to publications not present in the labeled sources
- If another source QUOTES or REFERENCES a publication (e.g. an article says 'The Hindu called it...'), do NOT attribute to that publication directly. Instead say 'one reviewer noted...' or attribute to the source that actually provided the content.

STRUCTURE (follow this exactly):
1. HOOK (1 sentence): The most interesting or controversial thing about this movie's reception. Not a generic intro. This should make someone want to keep reading.

2. CRITIC TAKE (2-3 sentences): What professional reviewers said. Name specific publications when possible ("The Guardian called it..." or "Variety praised..."). Include their specific praise or criticism.

3. REDDIT TAKE (2-3 sentences): What real people think. Reference specific subreddits when the data shows them (r/movies, r/horror, r/TrueFilm). Paraphrase actual comments that capture the mood. Show the real disagreements.

4. VERDICT (2-3 sentences): Your confident recommendation. Tell the reader specifically WHO will love this and WHO should skip it. Be specific about the type of viewer.

TOTAL LENGTH: 150-250 words. Tight and punchy. No filler.

ABSOLUTE RULES:
- NEVER start with "Ah," or "So," or "Well,"
- NEVER use these phrases: "dive into", "at the end of the day", "it is worth noting", "at its core", "in conclusion", "cinematic experience", "thought-provoking exploration", "stands as", "delivers a", "offers a compelling", "is a testament to", "overall consensus", "mixed reception", "fans of the genre", "general audience"
- NEVER say "some viewers" or "many people". Be specific: "Reddit's r/horror crowd" or "critics at The Guardian"
- NEVER mention source counts, data quality, or confidence metrics
- NEVER hedge with "it depends on your taste". Commit to a take.
- Reference at least ONE specific scene, character, or moment
- If critics and Reddit disagree, that IS the story. Lead with it.
- **IMPORTANT**: In the "HOOK" sentence, refer to Reddit users as "audiences" or "viewers" instead of "Reddit users".
- **IMPORTANT**: If the verdict is "WORTH IT", the final sentence of the review MUST be a positive reinforcement. Do NOT end with a "but skip if..." warning. Put warnings earlier.

97: OUTPUT FORMAT (strict JSON, no markdown fences):
98: {
99:   "review_text": "The full review (150-250 words, ending with specific advice on who should watch/skip)",
100:   "verdict": "WORTH IT" | "NOT WORTH IT" | "MIXED BAG",
101:   "hook": "One punchy sentence, max 20 words, captures the most interesting thing about this movie's reception",
102:   "praise_points": ["Specific praise point 1", "Specific praise point 2"],
103:   "criticism_points": ["Specific criticism point 1", "Specific criticism point 2"],
104:   "vibe": "one-line vibe description",
105:   "confidence": "HIGH" | "MEDIUM" | "LOW",
106:   "critic_sentiment": "positive" | "mixed" | "negative",
107:   "reddit_sentiment": "positive" | "mixed" | "negative",
108:   "positive_pct": 70,
109:   "negative_pct": 20,
110:   "mixed_pct": 10,
111:   "tags": ["Tag1", "Tag2", "Tag3"],
112:   "best_quote": "The single most memorable quote",
113:   "quote_source": "Source of the quote"
114: }

SENTIMENT BREAKDOWN RULES:
- positive_pct + negative_pct + mixed_pct MUST equal 100.
- Base these on the actual distribution of opinions you analyzed.
"""


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
        temperature=0.4,
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
        
        # Sanitize text fields
        if "review_text" in data: data["review_text"] = sanitize_text(data["review_text"])
        if "hook" in data: data["hook"] = sanitize_text(data["hook"])
        if "best_quote" in data: data["best_quote"] = sanitize_text(data["best_quote"])
        if "praise_points" in data: 
            data["praise_points"] = [sanitize_text(p) for p in data["praise_points"]]
        if "criticism_points" in data: 
            data["criticism_points"] = [sanitize_text(p) for p in data["criticism_points"]]
            
        return LLMReviewOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
        # Fallback: try to extract what we can
        logger.warning(f"JSON parsing failed: {e}")
        return LLMReviewOutput(
            review_text=sanitize_text(content) if isinstance(content, str) else "Review generation failed.",
            verdict="MIXED BAG",
            praise_points=[],
            criticism_points=[],
            vibe="Unable to determine",
            confidence="LOW",
            hook="Review generation failed.",
            critic_sentiment="mixed",
            reddit_sentiment="mixed"
        )

