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

    # A. The "Hard" Blocklist (Immediate Ban)
    # These words almost never appear in safe, mainstream content contexts we care about.
    hard_blocklist = [
        "erotic", "voyeur", "nude", "taboo", "incest", "rape", 
        "lust", "fetish", "orgy", "sex ", "xxx", "porn", 
        "milf", "stepmom", "stepdad", "step-", "barely legal",
        "unsimulated sex", "real sex", "sexual obsession"
    ]
    
    for word in hard_blocklist:
        if word in text_to_check:
            return False

    # B. The "Risky" Blocklist (Quality Filter)
    # Words that are suggestive but allowed IF the movie is popular/established.
    # Logic: "Unfaithful" (2002) has 2000+ votes -> SAFE.
    #        "Unfaithful Neighbor" (2024) has 2 votes -> BLOCKED.
    risky_keywords = [
        "passion", "desire", "affair", "intimacy", "seduction", 
        "wife", "teacher", "student", "neighbor", "secret", 
        "temptation", "pleasure", "submission", "dominant",
        "sexual", "sexuality", "proclivities", "decadence", "perversion"
    ]

    vote_count = item.get("vote_count", 0)
    
    # If it's a "risky" topic, demand proof of quality (huge vote count for explicit-sounding stuff)
    for word in risky_keywords:
        if word in text_to_check:
            # If the movie is about "sexual proclivities" (Caligula) or "intimacy" (Love), 
            # it better be a massive blockbuster to pass.
            # "Love" (2015) has ~1800 votes. "Caligula" has ~900.
            # We need a threshold that blocks these but allows "Sex and the City" (2000+ votes).
            # Let's bump the threshold to 2000 for these specific risky words.
            if vote_count < 2000:
                return False
            break # Blocked

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
