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
        # Note: genre_ids are small ints (18, 28 etc), Keywords are large.
        # Sometimes keyowrds appear here in some API versions? Unlikely but safe to check.
        for gid in item["genre_ids"]:
            if gid in EROTICA_KEYWORD_IDS:
                return False
                
    if "keywords" in item:
        # Check if 'keywords' is a list of dicts (standard) or IDs
        keywords = item["keywords"]
        if isinstance(keywords, dict) and "keywords" in keywords:
            keywords = keywords["keywords"] # specific TMDB structure
            
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

    # B. The "Risky" Blocklist (The "Popularity Gate")
    # Words that are suggestive but allowed IF the movie is mainstream.
    # Logic: "Unfaithful" (2002) has 2000+ votes -> SAFE.
    #        "Unfaithful Neighbor" (2024) has 2 votes -> BLOCKED.
    risky_keywords = [
        "passion", "desire", "affair", "intimacy", "seduction", 
        "wife", "teacher", "student", "neighbor", "secret", 
        "temptation", "pleasure", "submission", "dominant",
        "sexual", "sexuality", "proclivities", "decadence", "perversion", "cheated"
    ]

    vote_count = item.get("vote_count", 0)
    
    # If it's a "risky" topic, demand massive proof of quality 
    for word in risky_keywords:
        if word in text_to_check:
            # Matches a risky word?
            # Must be a mainstream hit (Vote Count > 2500)
            # This allows "Basic Instinct" (4000+) or "Eyes Wide Shut" (5000+)
            # But kills "Love" (1800) and "Caligula" (900) and generic junk.
            if vote_count < 2500:
                return False
            break # If it passed the popularity gate, we stop checking risky words

    # 3. The "Spam Killer" 2.0 (Aggressive Low Vote Count)
    # SKIP for people/actors
    media_type = item.get("media_type", "movie")
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
