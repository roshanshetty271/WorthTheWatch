/**
 * Worth the Watch? — user-facing email helpers.
 *
 * Sends the welcome email via Resend (same dependency /api/contact uses) and mints/validates
 * one-click unsubscribe tokens. Unsubscribe links are HMAC-signed with INTERNAL_PROXY_SECRET —
 * the SAME secret the backend digest job uses — so either service can produce a token and this
 * app can validate it without requiring the user to be logged in.
 */
import crypto from "crypto";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL =
    process.env.NEWSLETTER_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";
const UNSUB_SECRET = process.env.INTERNAL_PROXY_SECRET || "";

// On-brand palette (matches the digest email + app theme).
const C = {
    bg: "#0b0b0f",
    card: "#15151c",
    text: "#e7e7ea",
    muted: "#9a9aa5",
    gold: "#e6b450",
    border: "#26262f",
};

export function siteUrl(): string {
    return (process.env.NEXT_PUBLIC_SITE_URL || "https://worth-the-watch.com").replace(/\/+$/, "");
}

export function unsubscribeUrl(userId: string): string {
    const token = crypto.createHmac("sha256", UNSUB_SECRET).update(String(userId)).digest("hex");
    return `${siteUrl()}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
    if (!UNSUB_SECRET || !userId || !token) return false;
    const expected = crypto.createHmac("sha256", UNSUB_SECRET).update(String(userId)).digest("hex");
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export function welcomeEmailHtml(name: string, unsubUrl: string): string {
    const site = siteUrl();
    return `<!doctype html>
<html><body style="margin:0;padding:0;background:${C.bg};">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <img src="${site}/images/icon-512.png" width="52" height="52" alt="Worth the Watch?" style="border-radius:12px;display:block;margin:0 0 10px;" />
    <p style="margin:0 0 4px;font-size:18px;font-weight:800;color:${C.gold};">Worth the Watch?</p>
    <p style="margin:0 0 24px;font-size:13px;color:${C.muted};">Should you stream it? The internet decides.</p>
    <div style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:22px;color:${C.text};">Welcome, ${name}! 🍿</h1>
      <p style="margin:0 0 14px;color:${C.muted};font-size:15px;line-height:1.6;">
        No more 40 minutes scrolling trailers. Save anything you're curious about and we'll give it
        to you straight — <strong style="color:${C.text};">Worth It</strong> or <strong style="color:${C.text};">Not</strong>.
      </p>
      <p style="margin:0 0 20px;color:${C.muted};font-size:15px;line-height:1.6;">
        Once a month we'll send you the best new picks plus whatever the internet's losing its mind
        over. No spam, ever.
      </p>
      <a href="${site}" style="display:inline-block;background:${C.gold};color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px;">Find something to watch →</a>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:${C.muted};line-height:1.6;">
      Prefer weekly, or none at all? Set it in <a href="${site}/profile" style="color:${C.gold};">your profile</a>
      · <a href="${unsubUrl}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a>
    </p>
  </div>
</body></html>`;
}

export async function sendWelcomeEmail(
    to: string,
    name: string | null | undefined,
    userId: string
): Promise<boolean> {
    if (!RESEND_API_KEY || !to) {
        console.warn("Welcome email skipped (RESEND_API_KEY or recipient missing)");
        return false;
    }
    try {
        const { Resend } = require("resend");
        const resend = new Resend(RESEND_API_KEY);
        const unsub = unsubscribeUrl(userId);
        await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject: "Welcome to Worth the Watch 🍿",
            html: welcomeEmailHtml(name?.split(" ")[0] || "there", unsub),
            headers: {
                "List-Unsubscribe": `<${unsub}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        });
        return true;
    } catch (err) {
        console.error("Welcome email failed (non-blocking):", err);
        return false;
    }
}
