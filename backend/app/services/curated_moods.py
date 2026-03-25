"""
Worth the Watch? — Curated Mood Lists
25 iconic picks + 25 underrated gems per mood = 50 total.
Interleaved so users see a mix of known and unknown.

Sources: Rotten Tomatoes, Ranker, IMDb, Collider, IndieWire,
WatchMojo, BuzzFeed, Letterboxd, Reddit r/movies.
"""


def _interleave(iconic: list[int], underrated: list[int]) -> list[int]:
    """Interleave iconic and underrated: iconic, underrated, iconic, underrated..."""
    result = []
    seen = set()
    i, u = 0, 0
    while i < len(iconic) or u < len(underrated):
        if i < len(iconic) and iconic[i] not in seen:
            result.append(iconic[i])
            seen.add(iconic[i])
            i += 1
        if u < len(underrated) and underrated[u] not in seen:
            result.append(underrated[u])
            seen.add(underrated[u])
            u += 1
        if i >= len(iconic) and u >= len(underrated):
            break
    return result[:50]


# ═══════════════════════════════════════════════════════════════
# TIRED — Comfort watches, cozy, feel-good, easy vibes
# ═══════════════════════════════════════════════════════════════

TIRED_ICONIC = [
    13,       # Forrest Gump
    862,      # Toy Story
    194,      # Amelie
    120467,   # The Grand Budapest Hotel
    2062,     # Ratatouille
    8587,     # The Lion King (1994)
    2493,     # The Princess Bride
    14160,    # Up
    8392,     # My Neighbor Totoro
    508442,   # Soul
    10681,    # WALL-E
    585,      # Monsters, Inc.
    12,       # Finding Nemo
    277834,   # Moana
    313369,   # La La Land
    671,      # Harry Potter 1
    105,      # Back to the Future
    137,      # Groundhog Day
    15121,    # The Sound of Music
    11,       # Star Wars: A New Hope
    1726,     # Iron Man
    346698,   # Barbie
    607,      # Men in Black
    9806,     # The Incredibles
    22,       # Pirates of the Caribbean
]

TIRED_UNDERRATED = [
    212778,   # Chef
    840430,   # The Holdovers
    116149,   # Paddington
    508943,   # Luca
    116745,   # The Secret Life of Walter Mitty
    59436,    # Midnight in Paris
    257211,   # The Intern
    122906,   # About Time
    490132,   # Green Book
    568124,   # Encanto
    38757,    # Tangled
    508947,   # Turning Red
    153,      # Lost in Translation
    8346,     # My Big Fat Greek Wedding
    37165,    # The Truman Show
    787699,   # Wonka
    321612,   # Beauty and the Beast (2017)
    1584,     # School of Rock
    637,      # Life Is Beautiful
    673,      # Harry Potter 3 (Prisoner of Azkaban)
    207703,   # Kingsman: The Secret Service
    114150,   # Pitch Perfect
    11257,    # A Room with a View
    81,       # Nausicaa of the Valley of the Wind
    489,      # Good Will Hunting
]


# ═══════════════════════════════════════════════════════════════
# PUMPED — Adrenaline, high-octane, jaw-dropping
# ═══════════════════════════════════════════════════════════════

PUMPED_ICONIC = [
    76341,    # Mad Max: Fury Road
    245891,   # John Wick
    603,      # The Matrix
    562,      # Die Hard
    280,      # Terminator 2
    98,       # Gladiator
    155,      # The Dark Knight
    361743,   # Top Gun: Maverick
    27205,    # Inception
    24,       # Kill Bill: Vol. 1
    680,      # Pulp Fiction
    122,      # LOTR: Return of the King
    68718,    # Django Unchained
    857,      # Saving Private Ryan
    36557,    # Casino Royale (2006)
    263115,   # Logan
    353081,   # Mission: Impossible - Fallout
    324857,   # Spider-Man: Into the Spider-Verse
    1891,     # The Empire Strikes Back
    2501,     # The Bourne Identity
    348,      # Alien
    238,      # The Godfather
    807,      # Se7en
    85,       # Raiders of the Lost Ark
    244786,   # Whiplash
]

PUMPED_UNDERRATED = [
    94329,    # The Raid: Redemption
    579974,   # RRR
    840326,   # Sisu
    449992,   # The Night Comes for Us
    718930,   # Bullet Train
    146,      # Crouching Tiger, Hidden Dragon
    1368,     # First Blood (Rambo)
    228150,   # Fury
    545609,   # Extraction
    577922,   # Tenet
    1124,     # The Prestige
    496243,   # Parasite
    5548,     # RoboCop (1987)
    956,      # Mission: Impossible (1996)
    10528,    # Sherlock Holmes (2009)
    872585,   # Oppenheimer
    475557,   # Joker
    11324,    # Shutter Island
    600,      # Full Metal Jacket
    399579,   # Alita: Battle Angel
    866398,   # The Beekeeper
    569094,   # Spider-Verse 2
    119450,   # Dawn of the Planet of the Apes
    557,      # Spider-Man (2002)
    823464,   # Godzilla x Kong
]


# ═══════════════════════════════════════════════════════════════
# EMOTIONAL — Tearjerkers, gut-punch, ugly cry
# ═══════════════════════════════════════════════════════════════

EMOTIONAL_ICONIC = [
    424,      # Schindler's List
    497,      # The Green Mile
    597,      # Titanic
    637,      # Life Is Beautiful
    278,      # The Shawshank Redemption
    857,      # Saving Private Ryan
    13,       # Forrest Gump
    11036,    # The Notebook
    207,      # Dead Poets Society
    38,       # Eternal Sunshine of the Spotless Mind
    142,      # Brokeback Mountain
    76203,    # 12 Years a Slave
    1402,     # The Pursuit of Happyness
    238,      # The Godfather
    240,      # The Godfather Part II
    14160,    # Up
    8587,     # The Lion King
    9800,     # Philadelphia
    14306,    # Marley and Me
    14,       # American Beauty
    332562,   # A Star Is Born (2018)
    329865,   # Arrival
    152601,   # Her
    313369,   # La La Land
    492188,   # Marriage Story
]

EMOTIONAL_UNDERRATED = [
    12477,    # Grave of the Fireflies
    423,      # The Pianist
    517814,   # Capernaum
    334543,   # Lion
    334541,   # Manchester by the Sea
    14574,    # The Boy in the Striped Pyjamas
    80278,    # The Impossible
    4347,     # Atonement
    398818,   # Call Me by Your Name
    266856,   # The Theory of Everything
    9587,     # Little Women (1994)
    11050,    # Terms of Endearment
    222935,   # The Fault in Our Stars
    4032,     # My Girl
    10024,    # My Sister's Keeper
    581734,   # Nomadland
    428449,   # A Ghost Story
    399055,   # The Shape of Water
    490132,   # Green Book
    6023,     # P.S. I Love You
    122906,   # About Time
    475557,   # Joker
    153,      # Lost in Translation
    120467,   # The Grand Budapest Hotel
    508442,   # Soul
]


# ═══════════════════════════════════════════════════════════════
# CEREBRAL — Mind-benders, think for days
# ═══════════════════════════════════════════════════════════════

CEREBRAL_ICONIC = [
    27205,    # Inception
    77,       # Memento
    157336,   # Interstellar
    603,      # The Matrix
    550,      # Fight Club
    11324,    # Shutter Island
    329865,   # Arrival
    1124,     # The Prestige
    38,       # Eternal Sunshine of the Spotless Mind
    680,      # Pulp Fiction
    807,      # Se7en
    274,      # The Silence of the Lambs
    496243,   # Parasite
    872585,   # Oppenheimer
    78,       # Blade Runner
    141,      # Donnie Darko
    62,       # 2001: A Space Odyssey
    475557,   # Joker
    238,      # The Godfather
    210577,   # Gone Girl
    37165,    # The Truman Show
    244786,   # Whiplash
    286217,   # The Martian
    14,       # American Beauty
    489,      # Good Will Hunting
]

CEREBRAL_UNDERRATED = [
    264660,   # Ex Machina
    577922,   # Tenet
    1018,     # Mulholland Drive
    6977,     # No Country for Old Men
    63,       # Twelve Monkeys
    1954,     # The Butterfly Effect
    220289,   # Coherence
    14337,    # Primer
    206487,   # Predestination
    4977,     # Paprika
    152601,   # Her
    73,       # American History X
    453,      # A Beautiful Mind
    207,      # Dead Poets Society
    581734,   # Nomadland
    428449,   # A Ghost Story
    266856,   # The Theory of Everything
    334543,   # Lion
    492188,   # Marriage Story
    593,      # Solaris (1972)
    500,      # Reservoir Dogs
    539,      # Psycho
    106646,   # The Wolf of Wall Street
    640,      # Catch Me If You Can
    76600,    # Avatar: The Way of Water
]


# ═══════════════════════════════════════════════════════════════
# FUN — Popcorn, crowd-pleasers, pure enjoyment
# ═══════════════════════════════════════════════════════════════

FUN_ICONIC = [
    329,      # Jurassic Park
    324857,   # Spider-Man: Into the Spider-Verse
    862,      # Toy Story
    9806,     # The Incredibles
    22,       # Pirates of the Caribbean
    346698,   # Barbie
    11,       # Star Wars: A New Hope
    155,      # The Dark Knight
    1726,     # Iron Man
    585,      # Monsters, Inc.
    12,       # Finding Nemo
    14160,    # Up
    105,      # Back to the Future
    680,      # Pulp Fiction
    76341,    # Mad Max: Fury Road
    361743,   # Top Gun: Maverick
    120,      # LOTR: Fellowship
    671,      # Harry Potter 1
    557,      # Spider-Man (2002)
    27205,    # Inception
    85,       # Raiders of the Lost Ark
    313369,   # La La Land
    8587,     # The Lion King
    137,      # Groundhog Day
    607,      # Men in Black
]

FUN_UNDERRATED = [
    569094,   # Spider-Verse 2
    207703,   # Kingsman: The Secret Service
    718930,   # Bullet Train
    1584,     # School of Rock
    2493,     # The Princess Bride
    10681,    # WALL-E
    277834,   # Moana
    38757,    # Tangled
    508947,   # Turning Red
    568124,   # Encanto
    508943,   # Luca
    508442,   # Soul
    114150,   # Pitch Perfect
    68718,    # Django Unchained
    238713,   # Spy (2015)
    9880,     # The Princess Diaries
    787699,   # Wonka
    321612,   # Beauty and the Beast (2017)
    116149,   # Paddington
    10528,    # Sherlock Holmes (2009)
    8346,     # My Big Fat Greek Wedding
    212778,   # Chef
    95,       # Armageddon
    2062,     # Ratatouille
    1895,     # Star Wars: Return of the Jedi
]


# ═══════════════════════════════════════════════════════════════
# Build final interleaved lists
# ═══════════════════════════════════════════════════════════════

CURATED_MOODS = {
    "tired": _interleave(TIRED_ICONIC, TIRED_UNDERRATED),
    "pumped": _interleave(PUMPED_ICONIC, PUMPED_UNDERRATED),
    "emotional": _interleave(EMOTIONAL_ICONIC, EMOTIONAL_UNDERRATED),
    "cerebral": _interleave(CEREBRAL_ICONIC, CEREBRAL_UNDERRATED),
    "fun": _interleave(FUN_ICONIC, FUN_UNDERRATED),
}
