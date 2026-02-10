"""
Worth the Watch? — Opinion Grep Service
Zero-cost keyword filtering. Strips 100K tokens → 5-8K tokens of pure opinion signal.
No LLM call needed. Runs in milliseconds.
"""

from difflib import SequenceMatcher

# ─── Positive signals: paragraphs likely containing opinions ───
# ─── Positive signals: paragraphs likely containing opinions ───
OPINION_KEYWORDS = [
    # Positive sentiment
    "loved", "amazing", "masterpiece", "brilliant", "stunning",
    "best", "incredible", "perfect", "must watch", "blown away",
    "captivating", "gripping", "phenomenal", "outstanding", "superb",
    "heartfelt", "moving", "beautifully", "powerful", "compelling",
    "enjoyable", "entertaining", "engaging", "solid", "decent",
    "touching", "emotional", "hilarious", "funny", "laugh", 
    "cried", "tears", "iconic", "memorable",
    
    # Negative sentiment
    "boring", "terrible", "waste", "disappointed", "awful",
    "worst", "overrated", "mediocre", "skip", "dragged", "cringe",
    "forgettable", "predictable", "shallow", "annoying", "tedious",
    "unwatchable", "laughable", "weak", "bland", "generic",
    "cliché", "messy", "disappointing", "frustrating", "pointless",
    "underwhelming", "pretentious",
    
    # Opinion indicators
    "i think", "i felt", "in my opinion", "honestly",
    "the problem is", "what works", "what doesn't",
    "my take", "genuinely", "surprisingly", "unfortunately",
    "have to say", "worth watching", "not worth", "worth your time",
    "don't bother", "waste of time", "highly recommend",
    
    # Craft-specific (Broadened)
    "acting", "writing", "pacing", "cinematography", "directing",
    "direction", "screenplay", "script", "dialogue", "visuals",
    "visual style", "shot beautifully", "editing", "score",
    "soundtrack", "music", "performances", "performance",
    "chemistry", "casting", "atmosphere", "tone", "world-building",
    "character development", "special effects", "vfx", "cgi",
    "storyline", "plot was", "plot is", "story was", "story is",
    "ending was", "ending is", "third act", "finale",
    
    # Verdict/Rating signals
    "recommend", "worth", "stream", "watch", "avoid",
    "rating", "/10", "out of 10", "out of 5", "stars", "verdict",
    "thumbs up", "thumbs down", "must-see", "must see", "grade",
    "A+", "A-", "B+", "B-", "C+", "C-", "D+", "D-", "F",
    
    # Awards/Comparison
    "oscar", "academy award", "nominated", "award", "best picture",
    "underrated", "overhyped", "underhyped", "better than",
    "worse than", "compared to", "reminds me of",
]

# High-impact keywords that justify keeping short paragraphs (30-100 chars)
STRONG_KEYWORDS = {
    "masterpiece", "terrible", "brilliant", "awful", "boring", 
    "amazing", "loved", "hated", "worst", "best", "perfect", 
    "garbage", "waste", "must-see", "must see", "skip", "avoid",
    "incredible", "stunning", "phenomenal", "unwatchable",
    "heartbreaking", "hilarious", "10/10", "0/10", "5/5", "A+"
}

# ─── Negative signals: paragraphs to DISCARD ───
DISCARD_SIGNALS = [
    # Plot/synopsis
    "release date", "released on", "premieres on",
    "the story follows", "the film tells", "synopsis",
    "the plot centers", "the movie follows", "the series follows",
    # Cast/crew bios
    "cast includes", "produced by", "directed by", "written by",
    "stars include", "executive producer", "showrunner",
    # Promotional / logistical
    "box office", "trailer", "now streaming on", "available on",
    "subscribe to", "click here", "read more", "sign up",
    "affiliate link", "sponsored", "advertisement",
    # Legal / meta
    "copyright", "all rights reserved", "terms of service",
    "privacy policy", "cookie policy",
    # Navigation junk
    "related articles", "you may also like", "share this",
    "leave a comment", "table of contents", "jump to",
    "runtime", "rated pg", "rated r", "certificate",
]


def extract_opinion_paragraphs(articles: list[str], max_paragraphs: int = 40) -> str:
    """
    Zero-cost grep: extract only opinion-rich paragraphs from articles.
    
    Process:
    1. Split each article into paragraphs
    2. Discard paragraphs matching negative signals (plot summaries, ads, etc.)
    3. Keep paragraphs with opinion keyword hits based on length rules
    4. Deduplicate near-identical paragraphs
    5. Return top N most opinion-rich paragraphs
    """
    relevant = []

    for article in articles:
        paragraphs = article.split("\n\n")
        for para in paragraphs:
            para_stripped = para.strip()
            para_lower = para_stripped.lower()

            # Length filter: Allow short punchy opinions (30+ chars)
            if len(para_stripped) < 30 or len(para_stripped) > 2000:
                continue

            # NEGATIVE GREP — discard paragraphs matching discard signals
            discard_hits = sum(1 for ds in DISCARD_SIGNALS if ds in para_lower)
            if discard_hits >= 1:
                continue

            # POSITIVE GREP — count opinion keyword hits
            keyword_hits = sum(1 for kw in OPINION_KEYWORDS if kw in para_lower)

            # Adaptive Threshold logic
            is_relevant = False
            
            if len(para_stripped) > 100:
                # Normal paragraph: 1 keyword is sufficient if it's a real opinion
                if keyword_hits >= 1:
                    is_relevant = True
            else:
                # Short paragraph (30-100 chars): Requires 1 STRONG keyword
                # "This is a masterpiece." -> kept
                # "The movie is long." -> discarded (visual check)
                strong_hits = sum(1 for skw in STRONG_KEYWORDS if skw in para_lower)
                if strong_hits >= 1:
                    is_relevant = True

            if is_relevant:
                relevant.append((keyword_hits, para_stripped))

    # Sort by keyword density (most opinion-rich first)
    relevant.sort(key=lambda x: x[0], reverse=True)

    # Deduplicate near-identical paragraphs
    unique = _deduplicate([text for _, text in relevant])

    # Return top paragraphs joined with separators
    return "\n\n---\n\n".join(unique[:max_paragraphs])


def _deduplicate(paragraphs: list[str], threshold: float = 0.8) -> list[str]:
    """Remove near-duplicate paragraphs using sequence matching."""
    unique = []
    for para in paragraphs:
        is_dup = False
        for existing in unique:
            # Quick length check before expensive comparison
            if abs(len(para) - len(existing)) / max(len(para), len(existing)) > 0.5:
                continue
            # Compare first 200 chars for speed
            ratio = SequenceMatcher(
                None, para[:200].lower(), existing[:200].lower()
            ).ratio()
            if ratio > threshold:
                is_dup = True
                break
        if not is_dup:
            unique.append(para)
    return unique


def get_source_diversity_score(urls: list[str]) -> dict:
    """Categorize URLs by source type for diversity tracking."""
    categories = {"critic": [], "reddit": [], "user_review": [], "news": [], "other": []}

    # Critic domains that DON'T block scrapers (removed rogerebert, nytimes)
    CRITIC_DOMAINS = [
        "collider", "ign", "screenrant", "variety", "vulture",
        "avclub", "indiewire", "deadline", "ew.com", "empireonline",
        "theguardian", "hollywoodreporter", "theplaylist",
        "slashfilm", "cinemablend", "filmschoolrejects",
        "thefilmstage", "playlist", "theringer", "polygon",
    ]

    for url in urls:
        url_lower = url.lower()
        if "reddit.com" in url_lower:
            categories["reddit"].append(url)
        elif any(domain in url_lower for domain in CRITIC_DOMAINS):
            categories["critic"].append(url)
        elif "letterboxd" in url_lower:
            categories["user_review"].append(url)
        else:
            categories["other"].append(url)

    return categories


def select_best_sources(serper_results: list[dict], movie_title: str, max_total: int = 15) -> tuple[list[str], list[str]]:
    """Pick diverse, high-quality URLs from search results with strict relevance filtering."""
    import re

    # Pre-filter blocked domains BEFORE categorizing (no wasted slots)
    BLOCKED = [
        "imdb.com", "rottentomatoes.com", "letterboxd.com",
        "rogerebert.com", "nytimes.com", "wsj.com", 
        "washingtonpost.com", "bloomberg.com", "newyorker.com",
        "wired.com", "youtube.com", "youtu.be", "twitter.com",
        "x.com", "instagram.com", "tiktok.com", "facebook.com",
    ]
    
    # ─── Title Relevance Filter ─────────────────────────────
    # Normalize title for comparison
    title_lower = movie_title.lower().strip()
    is_short_title = len(title_lower) <= 3
    
    relevant_results = []
    
    for r in serper_results:
        # Check for title presence in result fields
        r_title = r.get("title", "").lower()
        r_snippet = r.get("snippet", "").lower()
        r_link = r.get("link", "").lower()
        
        match = False
        if is_short_title:
            # Strict word boundary check for short titles (e.g. "Us", "X", "Up")
            # Avoids matching "Us" in "United States" or "X" in "Example"
            pattern = re.compile(rf"\b{re.escape(title_lower)}\b")
            if pattern.search(r_title) or pattern.search(r_snippet) or pattern.search(r_link):
                match = True
        else:
            # Standard check
            if title_lower in r_title or title_lower in r_snippet or title_lower in r_link:
                match = True
        
        if match:
            relevant_results.append(r)
    
    # Fallback: if filtering kills too many results, use original list
    # (Better to have some noise than zero data)
    if len(relevant_results) < 5:
        filtered_results = serper_results
    else:
        filtered_results = relevant_results

    # ─── Deduplication & Blocking ───────────────────────────
    seen_urls = set()
    unique_results = []
    for r in filtered_results:
        link = r.get("link", "").rstrip("/").split("#")[0]
        if link and link not in seen_urls and not any(d in link.lower() for d in BLOCKED):
            seen_urls.add(link)
            unique_results.append(r)
    
    urls = [r["link"] for r in unique_results if r.get("link")]
    
    categories = get_source_diversity_score(urls)

    selected = []
    selected.extend(categories["critic"][:5])       # 5 critic reviews
    selected.extend(categories["reddit"][:5])       # 5 Reddit threads
    selected.extend(categories["user_review"][:2])  # 2 user review sites
    selected.extend(categories["other"][:3])        # 3 other sources

    # If we don't have enough from categories, fill from remaining
    if len(selected) < max_total:
        remaining = [u for u in urls if u not in selected]
        selected.extend(remaining[: max_total - len(selected)])

    # Final deduplication — preserve order
    seen = set()
    unique_selected = []
    for url in selected:
        # Normalize URL (remove trailing slashes, fragments)
        normalized = url.rstrip("/").split("#")[0]
        if normalized not in seen:
            seen.add(normalized)
            unique_selected.append(url)
    
    # Build backfill list: extra non-Reddit URLs we can use if Reddit fails
    backfill = []
    for url in urls:
        normalized = url.rstrip("/").split("#")[0]
        if normalized not in seen and "reddit.com" not in normalized.lower():
            backfill.append(url)
            if len(backfill) >= 6:
                break

    return unique_selected[:max_total], backfill
