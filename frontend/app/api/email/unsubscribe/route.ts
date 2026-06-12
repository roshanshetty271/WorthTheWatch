/**
 * GET / POST /api/email/unsubscribe?u=<userId>&t=<hmac>
 * One-click unsubscribe from the Worth-It digest — no login required.
 *
 * The HMAC token (signed with INTERNAL_PROXY_SECRET, shared with the backend digest sender)
 * proves the link belongs to that user, so nobody can unsubscribe someone else. POST is here
 * for RFC 8058 one-click unsubscribe (the List-Unsubscribe-Post header).
 */
import { NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";
import { verifyUnsubscribeToken, siteUrl } from "@/lib/email";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

function page(heading: string, message: string): Response {
    const C = {
        bg: "#0b0b0f",
        card: "#15151c",
        text: "#e7e7ea",
        muted: "#9a9aa5",
        gold: "#e6b450",
        border: "#26262f",
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading} · Worth the Watch?</title></head>
<body style="margin:0;background:${C.bg};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:64px 20px;text-align:center;">
    <p style="font-size:18px;font-weight:800;color:${C.gold};margin:0 0 24px;">Worth the Watch?</p>
    <div style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:32px;">
      <h1 style="font-size:20px;color:${C.text};margin:0 0 10px;">${heading}</h1>
      <p style="font-size:14px;color:${C.muted};line-height:1.6;margin:0 0 24px;">${message}</p>
      <a href="${siteUrl()}/profile" style="display:inline-block;background:${C.gold};color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:10px 18px;border-radius:10px;">Manage preferences</a>
    </div>
  </div>
</body></html>`;
    return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

async function handle(req: NextRequest): Promise<Response> {
    const u = req.nextUrl.searchParams.get("u") || "";
    const t = req.nextUrl.searchParams.get("t") || "";

    if (!verifyUnsubscribeToken(u, t)) {
        return page(
            "Invalid link",
            "This unsubscribe link is invalid or has expired. You can manage your email preferences from your profile."
        );
    }

    try {
        const sql = getSQL();
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(10) DEFAULT 'monthly'`;
        await sql`UPDATE users SET digest_frequency = 'off' WHERE id = ${u}`;
        return page(
            "You're unsubscribed",
            "You won't receive the Worth-It digest anymore. Changed your mind? Re-enable it anytime in your profile."
        );
    } catch (err) {
        console.error("Unsubscribe error:", err);
        return page(
            "Something went wrong",
            "We couldn't update your preferences just now. Please try again from your profile."
        );
    }
}

export async function GET(req: NextRequest) {
    return handle(req);
}

export async function POST(req: NextRequest) {
    return handle(req);
}
