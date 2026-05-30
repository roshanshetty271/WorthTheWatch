/**
 * POST /api/feedback — Maintenance-window feedback.
 *
 * Email-only via Resend. Deliberately does NOT touch the database, so it keeps
 * working while Neon is suspended/over-quota (the whole reason the maintenance
 * page exists). Reuses the same Resend env vars as /api/contact.
 */
import { NextRequest, NextResponse } from "next/server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL;
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, loved, improve, company } = body ?? {};

        // Honeypot: bots fill the hidden "company" field. Silently accept + drop.
        if (company) {
            return NextResponse.json({ ok: true });
        }

        const safeLoved = String(loved ?? "").slice(0, 5000).trim();
        const safeImprove = String(improve ?? "").slice(0, 5000).trim();
        const safeEmail = String(email ?? "").slice(0, 200).trim();

        // Require at least one of the two boxes.
        if (!safeLoved && !safeImprove) {
            return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
        }
        // If an email was provided, it must look valid (it's optional otherwise).
        if (safeEmail && !isValidEmail(safeEmail)) {
            return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
        }

        if (RESEND_API_KEY && CONTACT_TO_EMAIL) {
            try {
                const { Resend } = require("resend");
                const resend = new Resend(RESEND_API_KEY);
                await resend.emails.send({
                    from: CONTACT_FROM_EMAIL,
                    to: CONTACT_TO_EMAIL,
                    subject: `[WTW Maintenance Feedback]${safeEmail ? ` — ${safeEmail}` : ""}`,
                    text:
                        `From: ${safeEmail || "anonymous"}\n` +
                        `Time: ${new Date().toISOString()}\n\n` +
                        `💛 What they love:\n${safeLoved || "—"}\n\n` +
                        `💡 What to improve / want to see:\n${safeImprove || "—"}\n`,
                });
            } catch (emailErr) {
                // Don't block the user. At least capture it in the platform logs.
                console.error("Resend feedback email failed:", emailErr);
                console.warn("Feedback (email failed):", { safeEmail, safeLoved, safeImprove });
            }
        } else {
            // Resend not configured — still log so nothing is lost.
            console.warn("Feedback received but Resend not configured:", {
                safeEmail,
                safeLoved,
                safeImprove,
            });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Feedback POST error:", error);
        return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
}
