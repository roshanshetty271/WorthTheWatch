"""
Worth the Watch? — Curated Mood Lists
45 iconic picks + 45 underrated gems per mood = 90 total.
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
    return result


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
    # ── New additions ──
    129,      # Spirited Away
    4935,     # Howl's Moving Castle
    16859,    # Kiki's Delivery Service
    354912,   # Coco
    150540,   # Inside Out
    509,      # Notting Hill
    161,      # Ocean's Eleven
    587,      # Big Fish
    773,      # Little Miss Sunshine
    515001,   # Jojo Rabbit
    10315,    # Fantastic Mr. Fox
    550988,   # Free Guy
    346648,   # Paddington 2
    508965,   # The Mitchells vs. the Machines
    4951,     # 10 Things I Hate About You
    11970,    # The Holiday
    315162,   # Puss in Boots: The Last Wish
    24803,    # Julie & Julia
    872,      # Singin' in the Rain
    8835,     # Legally Blonde
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
    # ── New additions ──
    371645,   # Hunt for the Wilderpeople
    228194,   # The Hundred-Foot Journey
    463257,   # The Peanut Butter Falcon
    198277,   # Begin Again
    369557,   # Sing Street
    13156,    # Secondhand Lions
    2270,     # Stardust
    245,      # About a Boy
    77338,    # The Intouchables
    4476,     # Chocolat
    9428,     # The Royal Tenenbaums
    283366,   # Brooklyn
    7340,     # Lars and the Real Girl
    97051,    # The Best Exotic Marigold Hotel
    1262,     # Stranger Than Fiction
    455661,   # In the Heights
    22881,    # The Blind Side
    4247,     # Elf
    14550,    # The Station Agent
    438631,   # Dumplin'
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
    # ── New additions ──
    949,      # Heat
    137113,   # Edge of Tomorrow
    1271,     # 300
    273481,   # Sicario
    324786,   # Hacksaw Ridge
    558449,   # Gladiator II
    560016,   # Monkey Man
    603692,   # John Wick: Chapter 4
    615457,   # Nobody
    59440,    # Warrior
    1089,     # Point Break
    13373,    # Ip Man
    180299,   # The Raid 2
    8681,     # Taken
    752,      # V for Vendetta
    27586,    # The Town
    64690,    # Drive
    84185,    # Snowpiercer
    339403,   # Baby Driver
    242582,   # Nightcrawler
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
    # ── New additions ──
    500664,   # Upgrade
    49049,    # Dredd
    341013,   # Atomic Blonde
    1029575,  # Rebel Ridge
    221981,   # The Guest
    310133,   # Green Room
    634528,   # Wrath of Man
    474335,   # Triple Frontier
    670,      # Oldboy (2003)
    44943,    # 13 Assassins
    11517,    # Ong-Bak
    38579,    # The Man from Nowhere
    37850,    # I Saw the Devil
    91344,    # Headhunters
    396535,   # Train to Busan
    18693,    # A Bittersweet Life
    359410,   # Road House (2024)
    156022,   # The Equalizer
    9312,     # Crank
    10999,    # Unleashed (Danny the Dog)
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
    # ── New additions ──
    376867,   # Moonlight
    264644,   # Room (2015)
    666277,   # Past Lives
    258230,   # A Monster Calls
    641,      # Requiem for a Dream
    454983,   # The Farewell
    354912,   # Coco
    44826,    # The Help
    1585,     # Mystic River
    13223,    # Gran Torino
    152532,   # Dallas Buyers Club
    359940,   # Three Billboards Outside Ebbing, Missouri
    419704,   # Lady Bird
    11202,    # The Curious Case of Benjamin Button
    177572,   # Big Hero 6
    508439,   # Onward
    515001,   # Jojo Rabbit
    587,      # Big Fish
    77338,    # The Intouchables
    150540,   # Inside Out
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
    # ── New additions ──
    916405,   # The Quiet Girl
    533444,   # Waves
    1443,     # The Virgin Suicides
    7326,     # Juno
    19913,    # Beasts of the Southern Wild
    7549,     # The Diving Bell and the Butterfly
    810693,   # Anatomy of a Fall
    945961,   # Killers of the Flower Moon
    429764,   # Minari
    613504,   # After Yang
    4538,     # The Painted Veil
    11377,    # Hachi: A Dog's Tale
    9836,     # The Perks of Being a Wallflower
    283366,   # Brooklyn
    463257,   # The Peanut Butter Falcon
    369557,   # Sing Street
    198277,   # Begin Again
    371645,   # Hunt for the Wilderpeople
    4476,     # Chocolat
    9428,     # The Royal Tenenbaums
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
    # ── New additions ──
    300668,   # Annihilation
    503919,   # The Lighthouse
    146233,   # Prisoners
    1949,     # Zodiac
    242582,   # Nightcrawler
    4553,     # The Machinist
    545611,   # Everything Everywhere All at Once
    670,      # Oldboy (2003)
    335984,   # Blade Runner 2049
    945961,   # Killers of the Flower Moon
    1422,     # The Departed
    389,      # 12 Angry Men
    97370,    # Under the Skin
    181886,   # Enemy
    666277,   # Past Lives
    810693,   # Anatomy of a Fall
    641,      # Requiem for a Dream
    10494,    # Perfect Blue
    949,      # Heat
    64690,    # Drive
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
    # ── New additions ──
    1398,     # Stalker (1979)
    9426,     # The Conversation
    9603,     # Caché (Hidden)
    23128,    # Synecdoche, New York
    10948,    # Waking Life
    128,      # Princess Mononoke
    747803,   # Civil War (2024)
    68734,    # Compliance
    11104,    # A Scanner Darkly
    4960,     # The Fountain
    4348,     # A Clockwork Orange
    935,      # Dr. Strangelove
    510,      # One Flew Over the Cuckoo's Nest
    627,      # Trainspotting
    10533,    # Brazil
    813,      # Taxi Driver
    1091,     # The Thing
    1933,     # eXistenZ
    475,      # Vertigo
    1480,     # The Game
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
    # ── New additions ──
    746036,   # The Fall Guy (2024)
    493529,   # Dungeons & Dragons: Honor Among Thieves
    546554,   # Knives Out
    290250,   # The Nice Guys
    445571,   # Game Night
    4638,     # Hot Fuzz
    8363,     # Superbad
    550988,   # Free Guy
    354912,   # Coco
    515001,   # Jojo Rabbit
    545611,   # Everything Everywhere All at Once
    150540,   # Inside Out
    161,      # Ocean's Eleven
    129,      # Spirited Away
    346648,   # Paddington 2
    315162,   # Puss in Boots: The Last Wish
    508965,   # The Mitchells vs. the Machines
    339403,   # Baby Driver
    137113,   # Edge of Tomorrow
    177572,   # Big Hero 6
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
    # ── New additions ──
    371645,   # Hunt for the Wilderpeople
    369557,   # Sing Street
    2270,     # Stardust
    463257,   # The Peanut Butter Falcon
    91344,    # Headhunters
    396535,   # Train to Busan
    77338,    # The Intouchables
    455661,   # In the Heights
    9428,     # The Royal Tenenbaums
    4247,     # Elf
    1262,     # Stranger Than Fiction
    228194,   # The Hundred-Foot Journey
    97051,    # The Best Exotic Marigold Hotel
    283366,   # Brooklyn
    245,      # About a Boy
    438631,   # Dumplin'
    198277,   # Begin Again
    4476,     # Chocolat
    13156,    # Secondhand Lions
    7340,     # Lars and the Real Girl
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
