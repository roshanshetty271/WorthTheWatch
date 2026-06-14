"""
Worth the Watch? — Deterministic verdict consensus.

ONE source of truth for turning the public rating landscape into a verdict. Applied as the
FINAL layer over both review generation (pipeline.py) and the live stats refresh
(jobs/stats_refresh.py), so a well-rated movie can never read MIXED BAG and the verdict no
longer coin-flips between regenerations.

Philosophy (validated against the full catalogue with a read-only dry-run):
  - When at least 2 real rating sources land on a confident score, the SCORES decide:
    emphatically high -> WORTH IT, emphatically low -> NOT WORTH IT.
  - In the ambiguous middle, OR when the data is too thin, the AI's verdict stands
    (it can lean on its own knowledge for films with no aggregate scores yet).

This leaves the large majority of verdicts untouched while fixing the cases the catalogue
got visibly wrong (e.g. Best-Picture winners stuck on MIXED BAG, a 9% movie reading MIXED).

The weights and thresholds below are FROZEN to match the approved dry-run. Changing any of
them changes verdicts across the whole catalogue — re-run the dry-run before you do.
"""

from typing import Optional, Tuple

# consensus >= this  -> WORTH IT ; consensus < NOT_WORTH_BELOW -> NOT WORTH IT.
WORTH_IT_AT = 78.0
NOT_WORTH_BELOW = 45.0
# Fewer than this many "strong" sources -> too thin to be sure, defer to the AI.
MIN_STRONG_SOURCES = 2


def compute_consensus(
    *,
    imdb_score: Optional[float] = None,
    rt_critic: Optional[float] = None,
    rt_audience: Optional[float] = None,
    metascore: Optional[float] = None,
    metacritic_user: Optional[float] = None,
    letterboxd: Optional[float] = None,
    trakt: Optional[float] = None,
    tmdb_score: Optional[float] = None,
) -> Tuple[Optional[float], int]:
    """Blend whatever ratings exist into one 0-100 consensus score.

    Each source is normalized to 0-100 then averaged by weight. IMDb (the largest crowd) and
    the critic aggregates carry the most signal; niche sources count but lightly. Returns
    (consensus_or_None, strong_source_count). Pure, no I/O — same inputs always give same out.
    """
    # (normalized 0-100 value, weight, counts_as_strong)
    sources = [
        (imdb_score * 10 if imdb_score is not None else None, 3.0, True),
        (rt_critic, 2.0, True),
        (rt_audience, 2.0, True),
        (metascore, 2.0, True),
        (letterboxd * 20 if letterboxd is not None else None, 1.5, True),
        (metacritic_user * 10 if metacritic_user is not None else None, 1.0, False),
        (trakt, 1.0, False),
        (tmdb_score * 10 if tmdb_score not in (None, 0) else None, 1.0, False),
    ]

    weighted_sum = 0.0
    weight_total = 0.0
    strong = 0
    for value, weight, counts_as_strong in sources:
        if value is None:
            continue
        weighted_sum += value * weight
        weight_total += weight
        if counts_as_strong:
            strong += 1

    if weight_total == 0:
        return None, 0
    return weighted_sum / weight_total, strong


def apply_consensus_override(
    verdict: str,
    *,
    imdb_score: Optional[float] = None,
    rt_critic: Optional[float] = None,
    rt_audience: Optional[float] = None,
    metascore: Optional[float] = None,
    metacritic_user: Optional[float] = None,
    letterboxd: Optional[float] = None,
    trakt: Optional[float] = None,
    tmdb_score: Optional[float] = None,
) -> str:
    """Final verdict layer. A confident, multi-source rating consensus overrides the incoming
    verdict at the extremes; otherwise the incoming verdict is returned unchanged. Idempotent:
    re-running it on its own output yields the same verdict (so generation and refresh agree).
    """
    consensus, strong = compute_consensus(
        imdb_score=imdb_score,
        rt_critic=rt_critic,
        rt_audience=rt_audience,
        metascore=metascore,
        metacritic_user=metacritic_user,
        letterboxd=letterboxd,
        trakt=trakt,
        tmdb_score=tmdb_score,
    )

    # Too little hard data to be sure — trust the AI's read (incl. its own knowledge).
    if consensus is None or strong < MIN_STRONG_SOURCES:
        return verdict

    if consensus >= WORTH_IT_AT:
        return "WORTH IT"
    if consensus < NOT_WORTH_BELOW:
        return "NOT WORTH IT"

    # Ambiguous middle — the AI's call stands.
    return verdict
