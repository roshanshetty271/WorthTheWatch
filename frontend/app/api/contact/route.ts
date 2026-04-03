/**
 * POST /api/contact — Store contact form submission + send email notification
 * No auth required. Rate limited by IP (3 per rolling 24h).
 */
import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { auth } from "@/auth";
import crypto from "crypto";

const CONTACT_IP_HASH_SALT = process.env.CONTACT_IP_HASH_SALT;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL;
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";

if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
    console.warn("⚠️ RESEND_API_KEY or CONTACT_TO_EMAIL missing — contact email notifications disabled");
}

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

function getClientIp(req: NextRequest): string {
    try {
        const { ipAddress } = require("@vercel/functions");
        return ipAddress(req) || "127.0.0.1";
    } catch {
        return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    }
}

function hashIp(ip: string): string {
    return crypto.createHash("sha256").update(`${CONTACT_IP_HASH_SALT}:${ip}`).digest("hex").slice(0, 64);
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
    if (!CONTACT_IP_HASH_SALT) {
        console.error("CONTACT_IP_HASH_SALT env var is missing");
        return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { name, email, message } = body;

        // Validation
        if (!name || typeof name !== "string" || name.trim().length === 0 || name.length > 200) {
            return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
        }
        if (!email || !isValidEmail(email) || email.length > 200) {
            return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
        }
        if (!message || typeof message !== "string" || message.trim().length === 0 || message.length > 5000) {
            return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
        }
        const safeName = String(name).slice(0, 200);
        const safeEmail = String(email).slice(0, 200);
        const safeMessage = String(message).slice(0, 5000);

        const sql = getSQL();

        // Ensure table exists
        await sql`
            CREATE TABLE IF NOT EXISTS contact_submissions (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                name VARCHAR(200),
                email VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                user_id UUID,
                ip_hash VARCHAR(64),
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_contact_ip_created ON contact_submissions(ip_hash, created_at)`;

        // Rate limit: 3 per rolling 24h per IP
        const ipHash = hashIp(getClientIp(req));
        const recentCount = await sql`
            SELECT COUNT(*) as count FROM contact_submissions
            WHERE ip_hash = ${ipHash} AND created_at > NOW() - INTERVAL '24 hours'
        `;
        if (parseInt(recentCount[0]?.count || "0", 10) >= 3) {
            return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
        }

        // Get user ID if signed in
        let userId: string | null = null;
        try {
            const session = await auth();
            userId = session?.user?.id || null;
        } catch { /* anonymous is fine */ }

        // Insert
        await sql`
            INSERT INTO contact_submissions (name, email, message, user_id, ip_hash)
            VALUES (${safeName}, ${safeEmail}, ${safeMessage}, ${userId}, ${ipHash})
        `;

        // Send email notification (best-effort — don't fail the request)
        if (RESEND_API_KEY && CONTACT_TO_EMAIL) {
            try {
                const { Resend } = require("resend");
                const resend = new Resend(RESEND_API_KEY);
                await resend.emails.send({
                    from: CONTACT_FROM_EMAIL,
                    to: CONTACT_TO_EMAIL,
                    subject: `[WTW Contact] ${safeName || "Anonymous"} — ${safeEmail}`,
                    text: `Name: ${safeName || "Not provided"}\nEmail: ${safeEmail}\nUser ID: ${userId || "Anonymous"}\nTime: ${new Date().toISOString()}\n\nMessage:\n${safeMessage}`,
                });
            } catch (emailErr) {
                console.error("Resend email failed (non-blocking):", emailErr);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Contact POST error:", error);
        return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
}
