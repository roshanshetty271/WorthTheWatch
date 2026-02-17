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
    11216,    # The Grand Budapest Hotel
    2062,     # Ratatouille
    8587,     # The Lion King (1994)
    4232,     # The Princess Bride
    14160,    # Up
    128,      # My Neighbor Totoro
    508442,   # Soul
    10681,    # WALL-E
    585,      # Monsters, Inc.
    12,       # Finding Nemo
    277834,   # Moana
    313369,   # La La Land
    671,      # Harry Potter 1
    105,      # Back to the Future
    3170,     # Groundhog Day
    425,      # The Sound of Music
    11,       # Star Wars: A New Hope
    1726,     # Iron Man
    346698,   # Barbie
    607,      # Men in Black
    9806,     # The Incredibles
    22,       # Pirates of the Caribbean
]

TIRED_UNDERRATED = [
    4348,     # Chef
    843906,   # The Holdovers
    11970,    # Paddington
    508943,   # Luca
    228161,   # The Secret Life of Walter Mitty
    38575,    # Midnight in Paris
    4951,     # The Intern
    122906,   # About Time
    490132,   # Green Book
    652837,   # Encanto
    38757,    # Tangled
    508947,   # Turning Red
    153,      # Lost in Translation
    8392,     # My Big Fat Greek Wedding
    37165,    # The Truman Show
    950387,   # Wonka
    321612,   # Beauty and the Beast (2017)
    1541,     # School of Rock
    637,      # Life Is Beautiful
    673,      # Harry Potter 3 (Prisoner of Azkaban)
    207703,   # Kingsman: The Secret Service
    50646,    # Pitch Perfect
    10229,    # A Room with a View
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
    7214,     # Casino Royale (2006)
    263115,   # Logan
    354912,   # Mission: Impossible - Fallout
    324857,   # Spider-Man: Into the Spider-Verse
    1891,     # The Empire Strikes Back
    9693,     # The Bourne Identity
    348,      # Alien
    238,      # The Godfather
    807,      # Se7en
    85,       # Raiders of the Lost Ark
    244786,   # Whiplash
]

PUMPED_UNDERRATED = [
    11631,    # The Raid: Redemption
    141052,   # RRR
    840326,   # Sisu
    278927,   # The Night Comes for Us
    620683,   # Bullet Train
    454,      # Crouching Tiger, Hidden Dragon
    1885,     # First Blood (Rambo)
    228150,   # Fury
    392044,   # Extraction
    577922,   # Tenet
    1124,     # The Prestige
    496243,   # Parasite
    310,      # RoboCop (1987)
    956,      # Mission: Impossible (1996)
    10528,    # Sherlock Holmes (2009)
    872585,   # Oppenheimer
    475557,   # Joker
    11324,    # Shutter Island
    600,      # Full Metal Jacket
    399579,   # Alita: Battle Angel
    1051896,  # The Beekeeper
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
    696,      # The Shawshank Redemption
    857,      # Saving Private Ryan
    13,       # Forrest Gump
    8966,     # The Notebook
    843,      # Dead Poets Society
    798,      # Eternal Sunshine of the Spotless Mind
    1585,     # Brokeback Mountain
    389,      # 12 Years a Slave
    1402,     # The Pursuit of Happyness
    238,      # The Godfather
    240,      # The Godfather Part II
    14160,    # Up
    8587,     # The Lion King
    508,      # Philadelphia
    4960,     # Marley and Me
    14,       # American Beauty
    520763,   # A Star Is Born (2018)
    329865,   # Arrival
    152601,   # Her
    313369,   # La La Land
    423204,   # Marriage Story
]

EMOTIONAL_UNDERRATED = [
    12477,    # Grave of the Fireflies
    423,      # The Pianist
    476292,   # Capernaum
    334533,   # Lion
    284293,   # Manchester by the Sea
    14574,    # The Boy in the Striped Pyjamas
    36685,    # The Impossible
    1433,     # Atonement
    398818,   # Call Me by Your Name
    264660,   # The Theory of Everything
    773,      # Little Women (1994)
    926,      # Terms of Endearment
    74643,    # The Fault in Our Stars
    9443,     # My Girl
    9475,     # My Sister's Keeper
    581734,   # Nomadland
    467244,   # A Ghost Story
    399055,   # The Shape of Water
    490132,   # Green Book
    4476,     # P.S. I Love You
    122906,   # About Time
    475557,   # Joker
    153,      # Lost in Translation
    11216,    # The Grand Budapest Hotel
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
    798,      # Eternal Sunshine of the Spotless Mind
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
    68721,    # Gone Girl
    37165,    # The Truman Show
    244786,   # Whiplash
    286217,   # The Martian
    14,       # American Beauty
    489,      # Good Will Hunting
]

CEREBRAL_UNDERRATED = [
    242224,   # Ex Machina
    577922,   # Tenet
    1817,     # Mulholland Drive
    8488,     # No Country for Old Men
    1858,     # Twelve Monkeys
    1954,     # The Butterfly Effect
    55167,    # Coherence
    8681,     # Primer
    11018,    # Predestination
    6977,     # Paprika
    152601,   # Her
    1359,     # American History X
    4638,     # A Beautiful Mind
    843,      # Dead Poets Society
    581734,   # Nomadland
    467244,   # A Ghost Story
    264660,   # The Theory of Everything
    334533,   # Lion
    423204,   # Marriage Story
    2770,     # Solaris (1972)
    500,      # Reservoir Dogs
    539,      # Psycho
    77338,    # The Wolf of Wall Street
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
    3170,     # Groundhog Day
    607,      # Men in Black
]

FUN_UNDERRATED = [
    569094,   # Spider-Verse 2
    207703,   # Kingsman: The Secret Service
    620683,   # Bullet Train
    1541,     # School of Rock
    4232,     # The Princess Bride
    10681,    # WALL-E
    277834,   # Moana
    38757,    # Tangled
    508947,   # Turning Red
    652837,   # Encanto
    508943,   # Luca
    508442,   # Soul
    50646,    # Pitch Perfect
    68718,    # Django Unchained
    238713,   # Spy (2015)
    11836,    # The Princess Diaries
    950387,   # Wonka
    321612,   # Beauty and the Beast (2017)
    11970,    # Paddington
    10528,    # Sherlock Holmes (2009)
    8392,     # My Big Fat Greek Wedding
    4348,     # Chef
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