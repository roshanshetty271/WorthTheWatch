/**
 * Worth the Watch? — User Email Preferences API
 * GET  /api/user-preferences — the signed-in user's digest cadence
 * POST /api/user-preferences — set it ({ digest_frequency: "off" | "weekly" | "monthly" })
 *
 * Requires authentication. Talks directly to the shared Neon `users` table (Auth.js-managed).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

const VALID = ["off", "weekly", "monthly"];

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sql = getSQL();
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(10) DEFAULT 'monthly'`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP`;

        const rows = await sql`SELECT digest_frequency FROM users WHERE id = ${session.user.id}`;
        const digest_frequency = ((rows[0] as any)?.digest_frequency as string) || "monthly";
        return NextResponse.json({ digest_frequency });
    } catch (error) {
        console.error("user-preferences GET error:", error);
        return NextResponse.json({ digest_frequency: "monthly" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const value = String(body?.digest_frequency || "");
        if (!VALID.includes(value)) {
            return NextResponse.json({ error: "Invalid value" }, { status: 400 });
        }

        const sql = getSQL();
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(10) DEFAULT 'monthly'`;
        await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP`;
        await sql`UPDATE users SET digest_frequency = ${value} WHERE id = ${session.user.id}`;

        return NextResponse.json({ success: true, digest_frequency: value });
    } catch (error) {
        console.error("user-preferences POST error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
