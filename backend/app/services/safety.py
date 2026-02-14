"""
Worth the Watch? — Safety Service
Centralized logic for filtering unsafe, softcore, and spam content.
"""

from datetime import datetime, timedelta

def is_safe_content(item: dict) -> bool:
    """
    Returns False if the item is adult, softcore, or low-quality spam.
    Checks ALL text fields for unsafe keywords.
    """
    # 1. Official Adult Flag
    if item.get("adult", False):
        return False

    # 2. KEYWORD FILTERS
    # Concatenate all text fields to check
    text_to_check = " ".join([
        item.get("title", ""),
        item.get("name", ""),
        item.get("original_title", ""),
        item.get("original_name", ""),
        item.get("overview", "")
    ]).lower()

    # A. The "Nuclear" Blocklist (Immediate Ban by ID)
    # Specific requests from user to block these:
    # 11634 (Love), 12551 (Caligula), 34094 (Paprika 1991), 34091 (Cheeky)
    # plus other known erotica classics that might slip through
    BANNED_IDS = {
        11634, 12551, 34094, 34091, 
        31203, 33763, 82506, 2567, 3014, 560057
    }
    if item.get("id") in BANNED_IDS:
        return False

    # A2. The Erotica ID Filter (Keywords)
    # If we have keyword IDs (from details fetch), block them instantly.
    # [190370, 155432, 596, 12361, 180536, 10740, 158431, 222476, 185045, 271618]
    EROTICA_KEYWORD_IDS = {190370, 155432, 596, 12361, 180536, 10740, 158431, 222476, 185045, 271618}
    
    # Check 'genre_ids' (standard) and 'keywords' (details)
    if "genre_ids" in item:
        for gid in item["genre_ids"]:
            if gid in EROTICA_KEYWORD_IDS:
                return False
                
    if "keywords" in item:
        keywords = item["keywords"]
        if isinstance(keywords, dict) and "keywords" in keywords:
            keywords = keywords["keywords"]
            
        if isinstance(keywords, list):
            for k in keywords:
                if isinstance(k, dict):
                    if k.get("id") in EROTICA_KEYWORD_IDS:
                        return False
                elif isinstance(k, int):
                     if k in EROTICA_KEYWORD_IDS:
                        return False

    # A3. The "Hard" Text Blocklist (Immediate Ban)
    # These words almost never appear in safe, mainstream content contexts we care about.
    hard_blocklist = [
        "erotic", "voyeur", "nude", "taboo", "incest", "rape", 
        "lust", "fetish", "orgy", "sex ", "xxx", "porn", 
        "milf", "stepmom", "stepdad", "step-", "barely legal",
        "unsimulated sex", "real sex", "sexual obsession",
        "tinto brass", "brass tinto", "softcore", "pink film"
    ]
    
    for word in hard_blocklist:
        if word in text_to_check:
            return False

    # B. The "Risky" Multi-Hit Filter
    # ─────────────────────────────────────────────────────────────
    # PREVIOUS BUG: Single common words like "student", "wife", "neighbor", "secret"
    # were blocking legitimate movies. "Primate (2026)" was blocked because its
    # overview said "college student". Thousands of normal movies were silently killed.
    #
    # NEW LOGIC: Only block if 2+ risky words appear AND vote count is low.
    # Real erotica always has MULTIPLE suggestive words in its overview.
    # A normal movie mentioning "affair" once will pass. A movie about
    # "passionate desire and seduction" (3 hits) with 12 votes gets blocked.
    #
    # REMOVED from list: "wife", "teacher", "student", "neighbor", "secret",
    # "temptation", "pleasure" — these are normal English words that appear
    # in thousands of legitimate movie overviews.
    # ─────────────────────────────────────────────────────────────
    risky_keywords = [
        "passion", "desire", "affair", "intimacy", "seduction",
        "submission", "dominant", "sexual", "sexuality",
        "proclivities", "decadence", "perversion", "cheated"
    ]

    vote_count = item.get("vote_count", 0)
    
    risky_hit_count = sum(1 for word in risky_keywords if word in text_to_check)
    
    # 2+ risky words in a low-vote movie = almost certainly erotica/softcore
    if risky_hit_count >= 2 and vote_count < 500:
        return False

    # 3. GHOST ENTRY FILTER
    # ─────────────────────────────────────────────────────────────
    # Kills junk TMDB entries like "Prima" (no poster, no votes, no data).
    # These are database stubs that should never appear in search results.
    # ─────────────────────────────────────────────────────────────
    media_type = item.get("media_type", "movie")
    if media_type != "person":
        has_poster = bool(item.get("poster_path"))
        
        # No poster + no votes = ghost entry, always block
        if not has_poster and vote_count == 0:
            return False
        
        # No poster + no overview + very few votes = junk
        has_overview = bool(item.get("overview", "").strip())
        if not has_poster and not has_overview and vote_count < 50:
            return False

    # 4. The "Spam Killer" 2.0 (Aggressive Low Vote Count)
    # SKIP for people/actors
    if media_type == "person":
        return True

    release_date_str = item.get("release_date") or item.get("first_air_date", "")
    
    if release_date_str:
        try:
            release_date = datetime.strptime(release_date_str, "%Y-%m-%d")
            days_old = (datetime.now() - release_date).days
            
            # Tier 1: Recent junk (> 3 months old, < 10 votes)
            if days_old > 90 and vote_count < 10:
                return False
                
            # Tier 2: Old junk (> 1 year old, < 20 votes)
            if days_old > 365 and vote_count < 20:
                return False

        except ValueError:
            pass # Ignore date parse errors

    return True