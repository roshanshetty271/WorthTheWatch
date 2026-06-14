"""
Worth the Watch? — Stats Refresh Job

Keeps the LIVE FACTS on each review current — ratings (IMDb/RT/Metascore/Letterboxd/Trakt),
budget/revenue, box office, awards, content flags — WITHOUT re-running the LLM/Serper/Jina.
Cheap: TMDB (free) + OMDB + MDBList only. Reuses the same enrichment helpers as generation.

It also re-applies the SCORE-DRIVEN verdict override against the fresh ratings, starting from
the stored raw LLM verdict (`reviews.base_verdict`), so a page can never show e.g. 95% RT under
a "MIXED BAG". This mirrors the score rules in pipeline.generate_review_for_movie — the
scrape-confidence-dependent branches there are intentionally NOT reproduced (no scrape data at
refresh time). **Keep `reapply_verdict` in sync with the override block in pipeline.py.**

Age-tiered cadence (never stops): <90d → daily · 90d–2y → weekly · >2y → monthly.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta

import httpx
from sqlalchemy import select, text
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.omdb import omdb_service
from app.services.mdblist import mdblist_service
from app.services.pipeline import _resolve_rating_context, _apply_review_enrichment
from app.services.verdict import apply_consensus_override

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Age tiers → how stale a title may get before it's "due" again ─────────
TIER_FRESH_DAYS = 90            # released within 90 days → in/just-left theaters
TIER_RECENT_DAYS = 365 * 2      # released within 2 years
DUE_FRESH = timedelta(days=1)   # fresh tier → refresh ~daily
DUE_RECENT = timedelta(days=7)  # recent tier → ~weekly
DUE_OLD = timedelta(days=30)    # old tier → ~monthly (slow trickle, never stops)


def stats_due(release_date, last_refreshed_at, now: datetime = None) -> bool:
    """Is a title due for a stats refresh by its age tier?"""
    now = now or datetime.utcnow()
    if last_refreshed_at is None:
        return True
    age = now - last_refreshed_at
    today = now.date()
    if release_date and release_date > today - timedelta(days=TIER_FRESH_DAYS):
        return age > DUE_FRESH
    if release_date and release_date > today - timedelta(days=TIER_RECENT_DAYS):
        return age > DUE_RECENT
    return age > DUE_OLD


def reapply_verdict(
    base_verdict: str,
    *,
    score,
    votes,
    positive_pct,
    criticism_points,
    praise_points,
    release_date,
) -> str:
    """Re-apply the score-driven verdict overrides against FRESH ratings, starting from the
    raw LLM verdict. Mirrors the score rules in pipeline.py (high-score privilege + low-score
    safety nets). Pure + idempotent: same base + same scores → same verdict."""
    verdict = base_verdict or "MIXED BAG"
    if score is None:
        return verdict

    pos = positive_pct
    crit = len(criticism_points or [])
    praise = len(praise_points or [])

    # Release-aware vote floor for the high-score privilege (mirror pipeline).
    min_votes = 500
    if release_date:
        days_old = (date.today() - release_date).days
        if days_old <= 14:
            min_votes = 100
        elif days_old <= 30:
            min_votes = 150
        elif days_old <= 90:
            min_votes = 250

    # 1) High Score Privilege — crowd has spoken (unless the LLM found genuine issues).
    if score > 7.5 and votes and votes > min_votes and verdict != "WORTH IT":
        if crit > praise:
            pass  # LLM found more criticism than praise — respect it
        elif pos is not None and pos < 45:
            pass
        else:
            verdict = "WORTH IT"

    # 2) NOT WORTH IT but crowd is positive → soften.
    if verdict == "NOT WORTH IT" and pos is not None and pos > 60:
        verdict = "MIXED BAG"

    # 3) IMDb floor — a 7.0+ with real votes shouldn't read NOT WORTH IT.
    if verdict == "NOT WORTH IT" and score >= 7.0 and votes and votes > 500:
        verdict = "MIXED BAG"

    # 4) Low Score Safety Net (<6.0) — only WORTH IT if sentiment is overwhelmingly positive.
    if score < 6.0 and votes and votes > 100 and verdict == "WORTH IT":
        if not (pos is not None and pos >= 80):
            verdict = "MIXED BAG"

    # 5) Hard low (<5.0 with votes) → never WORTH IT / MIXED.
    if score < 5.0 and votes and votes > 200 and verdict in ("WORTH IT", "MIXED BAG"):
        verdict = "NOT WORTH IT"

    # 6) 5.0–6.0 WORTH IT → MIXED unless overwhelmingly positive.
    if 5.0 <= score < 6.0 and votes and votes > 200 and verdict == "WORTH IT" \
            and (pos is None or pos < 80):
        verdict = "MIXED BAG"

    return verdict


async def refresh_review_stats(db: AsyncSession, movie: Movie, review: Review) -> bool:
    """Refresh ONE review's live facts + re-apply the verdict override. No LLM/Serper/Jina.
    Best-effort: returns True if anything was refreshed, False if no data came back."""
    tmdb_id = movie.tmdb_id
    mt = movie.media_type or "movie"

    # TMDB details → imdb_id + (movies) budget/revenue/popularity/votes. Free + current.
    details = {}
    imdb_id = None
    try:
        if mt == "movie":
            details = await tmdb_service.get_movie_details(tmdb_id) or {}
            imdb_id = details.get("imdb_id")
        else:
            ext = await tmdb_service.get_external_ids(tmdb_id, mt) or {}
            imdb_id = ext.get("imdb_id")
    except Exception as e:
        logger.warning(f"stats refresh: TMDB details failed for {tmdb_id}: {e}")

    year = movie.release_date.year if movie.release_date else None
    omdb_coro = (
        omdb_service.get_scores_by_imdb_id(imdb_id)
        if imdb_id
        else omdb_service.get_scores_by_title(movie.title, year, "series" if mt == "tv" else "movie")
    )
    omdb_data, mdblist_scores = await asyncio.gather(
        omdb_coro,
        mdblist_service.get_scores(tmdb_id, mt),
        return_exceptions=True,
    )
    omdb_data = omdb_data if not isinstance(omdb_data, Exception) else None
    mdblist_scores = mdblist_scores if not isinstance(mdblist_scores, Exception) else None

    if omdb_data is None and mdblist_scores is None and not details:
        # Got nothing (quota/lookup miss) — leave last_refreshed_at alone so we retry next cycle.
        logger.info(f"stats refresh: no data for '{movie.title}' — will retry next cycle")
        return False

    ctx = _resolve_rating_context(movie, omdb_data, mdblist_scores)

    # Prefer TMDB budget/revenue when present and >0 (current worldwide gross; MDBList lags,
    # and TMDB returns 0 for unknown — don't let a 0 wipe a real value).
    if details:
        tb, tr = details.get("budget"), details.get("revenue")
        if tb and tb > 0:
            ctx["budget"] = tb
        if tr and tr > 0:
            ctx["revenue"] = tr

    _apply_review_enrichment(review, ctx, omdb_data, mdblist_scores)

    # Refresh the Movie's TMDB signals (used for ranking / Discover / digest breakout).
    if details:
        if details.get("popularity") is not None:
            movie.tmdb_popularity = details["popularity"]
        if details.get("vote_average") is not None:
            movie.tmdb_vote_average = details["vote_average"]
        if details.get("vote_count") is not None:
            movie.tmdb_vote_count = details["vote_count"]

    # Re-apply the score-driven verdict override against the fresh numbers.
    if review.base_verdict is None:
        review.base_verdict = review.verdict  # backfill legacy rows
    fresh_score = ctx.get("imdb_score") if ctx.get("imdb_score") is not None else movie.tmdb_vote_average
    fresh_votes = ctx.get("imdb_votes") if ctx.get("imdb_votes") is not None else (movie.tmdb_vote_count or 0)
    review.verdict = reapply_verdict(
        review.base_verdict,
        score=fresh_score,
        votes=fresh_votes,
        positive_pct=review.positive_pct,
        criticism_points=review.criticism_points,
        praise_points=review.praise_points,
        release_date=movie.release_date,
    )
    # Final layer: same deterministic rating consensus as generation (see services/verdict.py).
    # A confident multi-source consensus decides the extremes; otherwise the verdict above stands.
    review.verdict = apply_consensus_override(
        review.verdict,
        imdb_score=ctx.get("imdb_score"),
        rt_critic=ctx.get("rt_critic_score"),
        rt_audience=ctx.get("rt_audience_score"),
        metascore=ctx.get("metascore"),
        metacritic_user=ctx.get("metacritic_user_score"),
        letterboxd=ctx.get("letterboxd_score"),
        trakt=ctx.get("trakt_score"),
        tmdb_score=movie.tmdb_vote_average,
    )

    review.last_refreshed_at = datetime.utcnow()
    return True


async def revalidate_movie(tmdb_id: int) -> None:
    """Best-effort: bust the Next.js ISR cache for one movie page so fresh numbers surface
    immediately. Used by the on-view path (one at a time — under the route's rate limit)."""
    if not settings.SITE_URL:
        return
    try:
        url = f"{settings.SITE_URL.rstrip('/')}/api/revalidate"
        async with httpx.AsyncClient(timeout=8) as client:
            await client.post(url, params={"path": f"/movie/{tmdb_id}"})
    except Exception as e:
        logger.debug(f"revalidate failed for {tmdb_id}: {e}")


async def refresh_one(tmdb_id: int, media_type: str = None) -> None:
    """On-view entry point: refresh a single title in its OWN session, then revalidate.
    Scheduled as a FastAPI BackgroundTask from the movie GET endpoint."""
    from app.database import async_session
    try:
        async with async_session() as db:
            q = select(Movie).options(joinedload(Movie.review)).where(Movie.tmdb_id == tmdb_id)
            if media_type:
                q = q.where(Movie.media_type == media_type)
            movie = (await db.execute(q)).unique().scalars().first()
            if movie and movie.review:
                ok = await refresh_review_stats(db, movie, movie.review)
                await db.commit()
                if ok:
                    await revalidate_movie(tmdb_id)
    except Exception as e:
        logger.warning(f"on-view stats refresh failed for {tmdb_id}: {e}")


async def run_stats_refresh(db: AsyncSession, limit: int = 200) -> dict:
    """Rolling, age-tiered batch refresh. Picks the titles that are 'due' by their age tier,
    stalest first, and refreshes up to `limit` of them. Bulk pages surface via the 10-min ISR
    (no per-movie revalidate here, to avoid the /api/revalidate rate limit)."""
    # Idempotent schema guards (column added in models.py; index for the ORDER BY).
    await db.execute(text("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS base_verdict VARCHAR(20)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS idx_reviews_last_refreshed ON reviews(last_refreshed_at)"))
    await db.commit()

    now = datetime.utcnow()
    today = now.date()
    params = {
        "fresh_date": today - timedelta(days=TIER_FRESH_DAYS),
        "recent_date": today - timedelta(days=TIER_RECENT_DAYS),
        "due_fresh": now - DUE_FRESH,
        "due_recent": now - DUE_RECENT,
        "due_old": now - DUE_OLD,
        "lim": limit,
    }
    rows = await db.execute(text("""
        SELECT m.id
        FROM reviews r JOIN movies m ON m.id = r.movie_id
        WHERE r.last_refreshed_at IS NULL
           OR (m.release_date IS NOT NULL AND m.release_date >  :fresh_date
                AND r.last_refreshed_at < :due_fresh)
           OR (m.release_date IS NOT NULL AND m.release_date <= :fresh_date AND m.release_date > :recent_date
                AND r.last_refreshed_at < :due_recent)
           OR ((m.release_date IS NULL OR m.release_date <= :recent_date)
                AND r.last_refreshed_at < :due_old)
        ORDER BY r.last_refreshed_at ASC NULLS FIRST
        LIMIT :lim
    """), params)
    movie_ids = [row[0] for row in rows.all()]
    if not movie_ids:
        logger.info("📊 Stats refresh: nothing due.")
        return {"refreshed": 0, "failed": 0, "due": 0}

    refreshed = failed = 0
    for mid in movie_ids:
        try:
            res = await db.execute(
                select(Movie).options(joinedload(Movie.review)).where(Movie.id == mid)
            )
            movie = res.unique().scalar_one_or_none()
            if not movie or not movie.review:
                continue
            if await refresh_review_stats(db, movie, movie.review):
                refreshed += 1
            await db.commit()
        except Exception as e:
            await db.rollback()
            failed += 1
            logger.warning(f"stats refresh failed for movie id={mid}: {e}")

    logger.info(f"📊 Stats refresh: {refreshed} refreshed, {failed} failed, {len(movie_ids)} due")
    return {"refreshed": refreshed, "failed": failed, "due": len(movie_ids)}
