"""
Worth the Watch? — Email Digest Job
Builds and sends the opt-in "Worth-It Digest" (weekly / monthly) to subscribers.

Per issue it leads with the *breakout* movie (currently trending on TMDB AND carrying our
WORTH IT verdict — "is the hype real?") when one is genuinely hot, then lists the freshest
WORTH-IT picks since the last issue. If there are no picks AND no breakout, nothing is sent
(the digest is never filler).

Subscribers live in the shared Auth.js-managed `users` table (same Neon DB as the backend),
read here via raw SQL. Sending reuses the throttle-free `send_email` helper. Idempotent:
`users.last_digest_sent_at` guards against double-sends if the cron fires twice.
"""

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote

from sqlalchemy import select, desc, text
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Movie, Review
from app.services.tmdb import tmdb_service
from app.services.alerts import send_email

logger = logging.getLogger(__name__)
settings = get_settings()

TMDB_IMG = "https://image.tmdb.org/t/p/w185"
PERIOD_DAYS = {"weekly": 7, "monthly": 30}
PICKS_LIMIT = 6

# ─── On-brand email palette (dark theme + gold accent) ─────
BG = "#0b0b0f"
CARD = "#15151c"
TEXT = "#e7e7ea"
MUTED = "#9a9aa5"
GOLD = "#e6b450"
GREEN = "#5fd08a"
BORDER = "#26262f"


# ─── Helpers ───────────────────────────────────────────────

def _site() -> str:
    return settings.SITE_URL.rstrip("/")


def _movie_url(tmdb_id: int, media_type: str) -> str:
    url = f"{_site()}/movie/{tmdb_id}"
    return url + "?type=tv" if media_type == "tv" else url


def unsubscribe_url(user_id) -> str:
    """One-click unsubscribe link, HMAC-signed with INTERNAL_PROXY_SECRET (shared with
    the frontend, which validates the same token)."""
    token = hmac.new(
        settings.INTERNAL_PROXY_SECRET.encode(),
        str(user_id).encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{_site()}/api/email/unsubscribe?u={quote(str(user_id))}&t={token}"


def _format_movie(m: Movie) -> dict:
    r = m.review
    return {
        "tmdb_id": m.tmdb_id,
        "title": m.title,
        "verdict": r.verdict if r else None,
        "hook": (r.hook or r.vibe or "") if r else "",
        "poster_url": f"{TMDB_IMG}{m.poster_path}" if m.poster_path else None,
        "url": _movie_url(m.tmdb_id, m.media_type),
    }


async def _ensure_columns(db: AsyncSession) -> None:
    """Idempotent: add digest columns to the Auth.js `users` table. ADD COLUMN ... DEFAULT
    backfills existing rows too, so every user is opt-out-subscribed to monthly."""
    await db.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(10) DEFAULT 'monthly'"
    ))
    await db.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP"
    ))
    await db.commit()


async def _get_picks(db: AsyncSession, since: datetime, limit: int) -> list[dict]:
    """Freshest WORTH-IT reviews since the last issue, most-popular first."""
    q = (
        select(Movie)
        .options(joinedload(Movie.review))
        .join(Review)
        .where(Review.verdict == "WORTH IT", Review.generated_at >= since)
        .order_by(desc(Movie.tmdb_popularity))
        .limit(limit)
    )
    rows = (await db.execute(q)).unique().scalars().all()
    return [_format_movie(m) for m in rows]


async def _get_breakout(db: AsyncSession, exclude_ids: set[int]) -> Optional[dict]:
    """The hottest currently-trending title that ALSO has our WORTH IT verdict."""
    try:
        trending = await tmdb_service.get_trending("all", "week")
    except Exception as e:
        logger.warning(f"Digest: trending fetch failed: {e}")
        return None
    trending_ids = [t.get("id") for t in trending if t.get("id")]
    if not trending_ids:
        return None
    q = (
        select(Movie)
        .options(joinedload(Movie.review))
        .join(Review)
        .where(Movie.tmdb_id.in_(trending_ids), Review.verdict == "WORTH IT")
        .order_by(desc(Movie.tmdb_popularity))
    )
    rows = (await db.execute(q)).unique().scalars().all()
    for m in rows:
        if m.tmdb_id not in exclude_ids:
            return _format_movie(m)
    return None


# ─── HTML rendering ────────────────────────────────────────

def _subject(period: str, breakout: Optional[dict], picks: list[dict]) -> str:
    if breakout:
        return f"🍿 Is {breakout['title']} worth the hype?"
    if picks:
        lead = picks[0]["title"]
        return f"This {period[:-2] if period.endswith('ly') else period}'s Worth-It picks — starting with {lead}"
    return "Your Worth-It picks"


def _button(text_: str, url: str) -> str:
    return (
        f'<a href="{url}" style="display:inline-block;background:{GOLD};color:#000;'
        f'text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;'
        f'border-radius:10px;">{text_}</a>'
    )


def _verdict_badge(verdict: Optional[str]) -> str:
    color = GREEN if verdict == "WORTH IT" else MUTED
    label = verdict or ""
    return (
        f'<span style="display:inline-block;font-size:11px;font-weight:700;'
        f'letter-spacing:.06em;color:{color};border:1px solid {color};'
        f'border-radius:999px;padding:2px 8px;">{label}</span>'
    )


def _breakout_block(b: dict) -> str:
    poster = (
        f'<img src="{b["poster_url"]}" width="120" alt="" '
        f'style="border-radius:10px;display:block;" />' if b.get("poster_url") else ""
    )
    return f"""
    <div style="background:{CARD};border:1px solid {BORDER};border-radius:16px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.12em;color:{GOLD};">🔥 BLOWING UP RIGHT NOW</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="vertical-align:top;width:120px;padding-right:16px;">{poster}</td>
          <td style="vertical-align:top;">
            <a href="{b['url']}" style="color:{TEXT};text-decoration:none;font-size:20px;font-weight:700;">{b['title']}</a>
            <div style="margin:8px 0;">{_verdict_badge(b['verdict'])}</div>
            <p style="margin:0 0 16px;color:{MUTED};font-size:14px;line-height:1.5;">{b['hook']}</p>
            {_button("See the full verdict →", b['url'])}
          </td>
        </tr>
      </table>
    </div>
    """


def _pick_row(p: dict) -> str:
    poster = (
        f'<img src="{p["poster_url"]}" width="56" alt="" '
        f'style="border-radius:8px;display:block;" />' if p.get("poster_url") else ""
    )
    return f"""
    <tr>
      <td style="vertical-align:top;width:56px;padding:10px 14px 10px 0;">{poster}</td>
      <td style="vertical-align:top;padding:10px 0;border-bottom:1px solid {BORDER};">
        <a href="{p['url']}" style="color:{TEXT};text-decoration:none;font-size:16px;font-weight:600;">{p['title']}</a>
        <span style="margin-left:8px;">{_verdict_badge(p['verdict'])}</span>
        <p style="margin:4px 0 0;color:{MUTED};font-size:13px;line-height:1.5;">{p['hook']}</p>
      </td>
    </tr>
    """


def _render_html(period: str, breakout: Optional[dict], picks: list[dict], unsub: str) -> str:
    cadence = "weekly" if period == "weekly" else "monthly"
    breakout_html = _breakout_block(breakout) if breakout else ""
    picks_html = ""
    if picks:
        rows = "".join(_pick_row(p) for p in picks)
        picks_html = f"""
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.12em;color:{MUTED};">FRESH WORTH-IT PICKS</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">{rows}</table>
        """
    return f"""<!doctype html>
<html>
<body style="margin:0;padding:0;background:{BG};">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <img src="{_site()}/images/icon-512.png" width="52" height="52" alt="Worth the Watch?" style="border-radius:12px;display:block;margin:0 0 10px;" />
    <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:{GOLD};letter-spacing:.02em;">Worth the Watch?</p>
    <p style="margin:0 0 28px;font-size:13px;color:{MUTED};">Should you stream it? The internet decides.</p>
    {breakout_html}
    {picks_html}
    <div style="margin:32px 0 0;padding-top:16px;border-top:1px solid {BORDER};">
      <p style="margin:0 0 6px;font-size:12px;color:{MUTED};line-height:1.6;">
        You're getting the <strong style="color:{TEXT};">{cadence}</strong> Worth-It digest.
        Change cadence anytime in <a href="{_site()}/profile" style="color:{GOLD};">your profile</a>.
      </p>
      <p style="margin:0;font-size:12px;color:{MUTED};">
        <a href="{unsub}" style="color:{MUTED};text-decoration:underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>"""


# ─── Entry point ───────────────────────────────────────────

async def run_digest(db: AsyncSession, period: str = "monthly", test_to: str = None) -> dict:
    """Build + send the digest for `period` ('weekly' | 'monthly'). Best-effort per
    recipient; returns a summary dict for the cron response."""
    period = period if period in PERIOD_DAYS else "monthly"
    days = PERIOD_DAYS[period]
    now = datetime.utcnow()
    since = now - timedelta(days=days)

    await _ensure_columns(db)

    # ── Content ──
    picks = await _get_picks(db, since, PICKS_LIMIT)
    breakout = await _get_breakout(db, exclude_ids={p["tmdb_id"] for p in picks})

    if not picks and not breakout:
        logger.info(f"📭 Digest ({period}): nothing worth sending this window — skipping.")
        return {"period": period, "sent": 0, "recipients": 0, "skipped": "no_content"}

    subject = _subject(period, breakout, picks)

    # Test mode: send ONE copy to a single address. No subscriber query, no DB writes —
    # safe to fire anytime without touching real users.
    if test_to:
        unsub = unsubscribe_url(test_to)
        html = _render_html(period, breakout, picks, unsub)
        ok = await send_email(
            test_to, f"[TEST] {subject}", html,
            headers={"List-Unsubscribe": f"<{unsub}>", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"},
        )
        logger.info(f"📧 Digest TEST → {test_to}: sent={ok}")
        return {"period": period, "test_to": test_to, "sent": 1 if ok else 0,
                "picks": len(picks), "breakout": breakout["title"] if breakout else None}

    # ── Recipients (opt-out monthly default), with double-send guard ──
    cutoff = now - timedelta(days=max(1, int(days * 0.9)))
    result = await db.execute(
        text(
            "SELECT id, email FROM users "
            "WHERE digest_frequency = :period "
            "AND email IS NOT NULL AND email <> '' "
            "AND (last_digest_sent_at IS NULL OR last_digest_sent_at < :cutoff)"
        ),
        {"period": period, "cutoff": cutoff},
    )
    recipients = result.all()
    if not recipients:
        logger.info(f"Digest ({period}): no eligible recipients.")
        return {"period": period, "sent": 0, "recipients": 0, "picks": len(picks)}

    sent = 0
    for uid, email in recipients:
        unsub = unsubscribe_url(uid)
        html = _render_html(period, breakout, picks, unsub)
        ok = await send_email(
            email,
            subject,
            html,
            headers={
                "List-Unsubscribe": f"<{unsub}>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        )
        if ok:
            await db.execute(
                text("UPDATE users SET last_digest_sent_at = :now WHERE id = :uid"),
                {"now": now, "uid": uid},
            )
            sent += 1
    await db.commit()

    logger.info(f"📧 Digest ({period}) sent to {sent}/{len(recipients)} subscribers.")
    return {
        "period": period,
        "sent": sent,
        "recipients": len(recipients),
        "picks": len(picks),
        "breakout": breakout["title"] if breakout else None,
    }
