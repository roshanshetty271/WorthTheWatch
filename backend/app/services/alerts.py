"""
Worth the Watch? — Email Alerts
Surfaces silent operational failures (e.g. Serper going dead) via email, so a broken
integration screams instead of quietly tanking review quality for weeks.

Sends through Resend's REST API with httpx (no extra dependency). Best-effort and
throttled — it must never crash or slow down the caller, and never flood the inbox.
"""

import logging
from datetime import datetime, timedelta

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"

# Per-issue cooldown so a broken integration (many failing calls) can't flood the inbox.
# In-memory: resets on restart, which is acceptable for alerting.
ALERT_COOLDOWN = timedelta(hours=6)
_last_sent: dict[str, datetime] = {}


async def send_alert(subject: str, body: str, dedupe_key: str) -> None:
    """Send a throttled alert email. Best-effort: failures are logged, never raised.

    Args:
        subject: email subject line
        body: plain-text body
        dedupe_key: throttle bucket — at most one email per ALERT_COOLDOWN per key
    """
    # Optional feature — silently degrade to log-only if not configured.
    if not settings.RESEND_API_KEY or not settings.ALERT_EMAIL:
        logger.warning(f"📭 Alert not emailed (RESEND_API_KEY/ALERT_EMAIL unset): {subject}")
        return

    now = datetime.utcnow()
    last = _last_sent.get(dedupe_key)
    if last and (now - last) < ALERT_COOLDOWN:
        logger.info(f"🔕 Alert '{dedupe_key}' suppressed (within {ALERT_COOLDOWN} cooldown)")
        return

    # Record before sending so concurrent failures don't all fire.
    _last_sent[dedupe_key] = now

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(
                RESEND_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.ALERT_FROM_EMAIL,
                    "to": [settings.ALERT_EMAIL],
                    "subject": subject,
                    "text": f"{body}\n\n— Worth the Watch? alerts ({now.isoformat()}Z)",
                },
            )
        if resp.status_code >= 300:
            logger.error(f"Alert email failed (HTTP {resp.status_code}): {(resp.text or '')[:200]}")
        else:
            logger.info(f"📧 Alert emailed: {subject}")
    except Exception as e:
        # Never let alerting break the caller.
        logger.error(f"Alert email error: {e}")
