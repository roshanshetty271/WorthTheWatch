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

MAX_OPINIONS_CHARS = 10000

# ─── Client Configuration ─────────────────────────────────

def _build_deepseek_client():
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
    """Remove JSON artifacts and cleanup text."""
    if not text:
        return ""
    text = str(text).strip()
    
    # Remove escaped quotes that might have slipped through double-encoding
    text = text.replace('\\"', '"').replace("\\'", "'")
    
    # Recursively remove invalid starting/ending characters
    while text and (text.startswith(('"', "'", "`")) or text.endswith(('"', "'", "`"))):
        text = text.strip(" \"'`")
        
    return text.strip()


def _build_openai_client():
    if settings.OPENAI_API_KEY:
        return (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY),
            "gpt-4o-mini",
        )
    return None, None


deepseek_client, deepseek_model = _build_deepseek_client()
openai_client, openai_model = _build_openai_client()

if settings.LLM_PROVIDER == "openai" and openai_client:
    llm_client, llm_model = openai_client, openai_model
elif deepseek_client:
    llm_client, llm_model = deepseek_client, deepseek_model
elif openai_client:
    llm_client, llm_model = openai_client, openai_model
else:
    llm_client = AsyncOpenAI(
        base_url="https://api.deepseek.com/v1",
        api_key="missing-key-set-DEEPSEEK_API_KEY-or-OPENAI_API_KEY-in-env",
    )
    llm_model = "deepseek-chat"


# ─── System Prompt (UNCHANGED) ─────────────────────────────

SYSTEM_PROMPT = """You are the voice behind "Worth the Watch?" — a movie review aggregator that reads what critics AND Reddit actually think, then delivers the real verdict.

YOUR PERSONALITY:
- You are the friend everyone asks for movie recommendations because you actually watch everything and have great taste.
- You are ENTHUSIASTIC about good movies. When something is WORTH IT, you SELL it. Make people excited to watch it.
- You are FUNNY about bad movies. When something is NOT WORTH IT, roast it with humor. Never be mean-spirited or depressing. Make people laugh about why it is bad.
- You are HONEST about mixed movies. Acknowledge the good and the bad without being wishy-washy.
- Your job is to HELP people decide, not to lecture them.

YOUR WRITING STYLE:
- Write like a knowledgeable friend giving honest advice over drinks
- Reference SPECIFIC things: scene names, character names, actor performances, plot moments. Never be vague.
- Capture the VIBE of internet discussion. If Reddit is fighting about something, say so. If critics loved what Reddit hated, highlight that tension.
- Use concrete language, not vague praise.
  BAD: "the performances were praised"
  GOOD: "Pedro Pascal steals every scene he walks into"
- Commit to your verdict. No wishy-washy hedging.
- Vary sentence length. Mix short punchy sentences with longer ones.
- Vary sentence length. Mix short punchy sentences with longer ones.
- Do NOT use contractions. Write "do not" not "don't", "it is" not "it's", "I have" not "I've"
- Do NOT use em dashes (—). Use periods, commas, or "and" instead.
- NEVER start a paragraph with a quote mark (") or apostrophe (').
- Do NOT use quote marks for emphasis (scare quotes). Only use them for direct citations.
- Do NOT output escaped JSON characters like \\" or \\' in the text. Ensure the text is clean.

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

2. CRITIC TAKE (2-3 sentences): What professional reviewers said. Name specific publications when possible. Include their specific praise or criticism.

3. REDDIT TAKE (2-3 sentences): What real people think. Reference specific subreddits when the data shows them. Paraphrase actual comments that capture the mood. Show the real disagreements.

4. VERDICT (2-3 sentences): Your confident recommendation.

TOTAL LENGTH: 150-250 words. Tight and punchy. No filler.

═══════════════════════════════════════════════════════════════
TONE RULES BY VERDICT (THIS IS CRITICAL — READ CAREFULLY):
═══════════════════════════════════════════════════════════════

IF VERDICT IS "WORTH IT":
- The ENTIRE review must have an enthusiastic, positive energy.
- Mention flaws early and briefly (1 sentence max), then move on to the good stuff.
- The LAST SENTENCE must be a specific, enthusiastic recommendation. Examples:
  GOOD: "This is the kind of movie you stay up until 2 AM finishing and do not regret it the next morning."
  GOOD: "Clear your schedule. This one earns every minute of its runtime."
  GOOD: "Put your phone down, turn the lights off, and let this one take you for a ride."
  BAD: "However, if you prefer straightforward narratives, skip this one."
  BAD: "If you are not a fan of slow pacing, this might not be for you."
- NEVER end a WORTH IT review with a warning, caveat, or "skip if" statement.
- NEVER use "however" in the last 2 sentences of a WORTH IT review.

IF VERDICT IS "NOT WORTH IT":
- Be funny, not mean. Roast the movie with wit, not cruelty.
- Acknowledge what it TRIED to do, then explain why it did not work.
- The last sentence should be humorous or offer a better alternative. Examples:
  GOOD: "Save your two hours and rewatch The Dark Knight instead."
  GOOD: "The trailer is genuinely the best version of this movie. Just watch that."
  BAD: "This movie is terrible and you should avoid it."
  BAD: "A waste of everyone's time."

IF VERDICT IS "MIXED BAG":
- Clearly state who will love it and who will not.
- Be balanced but decisive about the split.
- End with a specific recommendation for the right audience.

═══════════════════════════════════════════════════════════════

ABSOLUTE RULES:
- NEVER start with "Ah," or "So," or "Well,"
- NEVER use these phrases: "dive into", "at the end of the day", "it is worth noting", "at its core", "in conclusion", "cinematic experience", "thought-provoking exploration", "stands as", "delivers a", "offers a compelling", "is a testament to", "overall consensus", "mixed reception", "fans of the genre", "general audience"
- NEVER say "some viewers" or "many people". Be specific: "Reddit's r/horror crowd" or "critics at The Guardian"
- NEVER mention source counts, data quality, or confidence metrics
- NEVER hedge with "it depends on your taste". Commit to a take.
- NEVER use "However, if you prefer X, you might want to skip this one" or ANY variation of this pattern. This sentence is BANNED.
- NEVER end ANY review with a negative caveat or warning. The last sentence is always either enthusiastic (WORTH IT), funny (NOT WORTH IT), or decisive (MIXED BAG).
- Reference at least ONE specific scene, character, or moment
- If critics and Reddit disagree, that IS the story. Lead with it.
- In the "HOOK" sentence, refer to Reddit users as "audiences" or "viewers" instead of "Reddit users".

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "review_text": "The full review (150-250 words)",
  "verdict": "WORTH IT" | "NOT WORTH IT" | "MIXED BAG",
  "hook": "One punchy sentence, max 20 words, captures the most interesting thing",
  "praise_points": ["Specific praise point 1", "Specific praise point 2"],  // NEVER leave empty — see rules below
  "criticism_points": ["Specific criticism point 1", "Specific criticism point 2"],
  "vibe": "one-line vibe description",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "critic_sentiment": "positive" | "mixed" | "negative",
  "reddit_sentiment": "positive" | "mixed" | "negative",
  "positive_pct": 70,
  "negative_pct": 20,
  "mixed_pct": 10,
  "tags": ["Tag1", "Tag2", "Tag3"],
  "best_quote": "The single most memorable quote from the opinions",
  "quote_source": "Source of the quote"
}

CRITICAL RULES FOR TAGS:
- Tags must be SEPARATE strings in the array, like ["Feel-Good", "Funny", "Fast-Paced"]
- NEVER concatenate tags into one string like "Feel-GoodFunnyCerebral"
- Each tag is its OWN element in the array

SENTIMENT BREAKDOWN RULES:
- positive_pct + negative_pct + mixed_pct MUST equal 100.
- Base these on the actual distribution of opinions you analyzed.
"""


# ─── Synthesis Function ───────────────────────────────────

async def _call_llm(client: AsyncOpenAI, model: str, user_prompt: str) -> str:
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=1000, # ✅ FIXED: Increased to 1000 to prevent JSON crash
        timeout=60.0,
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
    media_type: str = "movie",
) -> LLMReviewOutput:
    """Generate a review with automatic LLM failover AND internal knowledge fallback."""

    # SECURITY: Truncate to prevent denial-of-wallet
    if len(opinions) > MAX_OPINIONS_CHARS:
        opinions = opinions[:MAX_OPINIONS_CHARS]
        logger.warning(f"⚠️ Opinions truncated to {MAX_OPINIONS_CHARS} chars for '{title}'")

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
- Write authoritatively."""

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

    content_label = "TV Series" if media_type == "tv" else "Movie"

    # ✅ FIXED: Enforcing strict word counts in prompt to ensure speed within the new token limit
    user_prompt = f"""{content_label}: {title} ({year})
Genre: {genres}
{score_context}
Description: {overview}

{data_context}

Opinions gathered from {sources_count} sources across the internet:

{opinions}

Write your "Worth the Watch?" review based on these real internet opinions.

MANDATORY INSTRUCTIONS:
1. Select 3-5 tags STRICTLY from this list: {', '.join(sorted(ALLOWED_TAGS))}. Do not invent new tags. Each tag MUST be a separate string in the JSON array.
2. Extract the single most memorable, funny, or insightful quote from the opinions.
3. Be specific in praise/criticism.
4. BE HONEST, NOT NICE. A 6.5/10 movie is MIXED BAG, not WORTH IT. If the opinions are split, lukewarm, or "it was okay", say MIXED BAG. WORTH IT means the viewer will genuinely enjoy this and it is worth their limited free time. MIXED BAG means it has good parts but also real problems. Do not hand out WORTH IT to be polite — earn it.
5. REMEMBER: If your verdict is WORTH IT, the last sentence MUST be enthusiastic and positive. No caveats. No "skip if" warnings. Sell the movie.
6. REMEMBER: If your verdict is NOT WORTH IT, be funny about it. Roast with humor, not cruelty.
7. CRITICAL SPEED RULE: Keep 'review_text' under 180 words. Be punchy and direct.
8. PRAISE POINTS RULE: praise_points must NEVER be an empty array. If the movie is genuinely terrible and you cannot find real praise, include ONE witty, self-aware line that humorously acknowledges there is nothing good. Make it specific to the movie, not generic. Examples: "At least it is only 89 minutes long", "The poster looked cool", "It made every other superhero movie look like a masterpiece by comparison". Be creative and funny.
"""

    content = None
    used_model = None

    # ─── TIER 1: Search Data ─────────────────────────────────
    try:
        logger.info(f"🧠 Trying primary LLM: {llm_model}")
        content = await _call_llm(llm_client, llm_model, user_prompt)
        used_model = llm_model
    except Exception as e:
        logger.warning(f"Primary LLM ({llm_model}) failed: {e}")
        
        # Try fallback client with SAME prompt (Technical Failover)
        fallback_client = openai_client if llm_client != openai_client else deepseek_client
        fallback_model = openai_model if llm_client != openai_client else deepseek_model
        
        if fallback_client:
            try:
                logger.info(f"🔄 Falling back to: {fallback_model} (Search Data)")
                content = await _call_llm(fallback_client, fallback_model, user_prompt)
                used_model = fallback_model
            except Exception as tech_fallback_error:
                logger.error(f"Fallback LLM ({fallback_model}) also failed: {tech_fallback_error}")
                content = None
        else:
            logger.error(f"No fallback client available for technical error: {e}")
            content = None

    # ─── TIER 2: Internal Knowledge Fallback ─────────────────
    # If content is STILL None (meaning technical failover failed OR search data was empty/bad)
    if content is None:
        logger.warning(f"⚠️ Search-based generation failed completely. Attempting Internal Knowledge Fallback for '{title}'.")
        
        # ✅ FIXED: New prompt that explicitly asks LLM to use internal knowledge
        knowledge_prompt = f"""
        Review the {content_label}: "{title}" ({year}).
        Genre: {genres}
        Overview: {overview}
        {score_context}

        CRITICAL: I do not have external search data for this title. 
        PLEASE USE YOUR INTERNAL KNOWLEDGE to write the review.
        
        If you absolutely do not know this movie, return valid JSON with:
        {{ "verdict": "MIXED BAG", "review_text": "We could not find enough data on this title yet.", "hook": "Data unavailable." }}
        
        Otherwise, follow the standard review format strictly.
        MANDATORY: Keep 'review_text' under 180 words.
        """

        try:
            # We prefer OpenAI for internal knowledge (usually better training data than sanitized DeepSeek)
            k_client = openai_client if openai_client else llm_client
            k_model = "gpt-4o-mini"
            
            content = await _call_llm(k_client, k_model, knowledge_prompt)
            used_model = f"{k_model} (Internal Knowledge)"
            logger.info(f"✅ Generated review using Internal Knowledge.")
            
        except Exception as final_error:
            # ─── TIER 3: Last Resort (Static Error) ────────────────
            logger.error(f"❌ All LLM attempts failed: {final_error}")
            return LLMReviewOutput(
                review_text="We are having trouble reaching our AI critics right now. Please try again in a moment.",
                verdict="MIXED BAG",
                hook="Service temporarily unavailable.",
                praise_points=[],
                criticism_points=[],
                vibe="System Error",
                confidence="LOW",
                critic_sentiment="mixed",
                reddit_sentiment="mixed"
            )

    logger.info(f"✅ Review generated using {used_model}")

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
        
        # Fix concatenated tags: if any tag contains multiple tag names without separator
        if "tags" in data and isinstance(data["tags"], list):
            fixed_tags = []
            for tag in data["tags"]:
                if isinstance(tag, str):
                    # Split tags that got concatenated (e.g., "CerebralEmotional" → ["Cerebral", "Emotional"])
                    if len(tag) > 20:
                        remaining = tag
                        for allowed in sorted(ALLOWED_TAGS, key=len, reverse=True):
                            while allowed.lower().replace("-", "") in remaining.lower().replace("-", ""):
                                fixed_tags.append(allowed)
                                idx = remaining.lower().replace("-", "").find(allowed.lower().replace("-", ""))
                                remaining = remaining[:idx] + remaining[idx + len(allowed.replace("-", "")):]
                    else:
                        fixed_tags.append(tag)
            if fixed_tags:
                data["tags"] = fixed_tags
            
        return LLMReviewOutput(**data)
    except (json.JSONDecodeError, Exception) as e:
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