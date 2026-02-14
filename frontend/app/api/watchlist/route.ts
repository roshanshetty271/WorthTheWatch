/**
 * Worth the Watch? — Watchlist API
 * GET /api/watchlist — List user's watchlist items
 * POST /api/watchlist — Add item to watchlist
 * 
 * Requires authentication. Returns 401 if not signed in.
 * Talks directly to Neon PostgreSQL.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

// Simple in-memory rate limit for POST (add to watchlist)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 }); // 1 minute window
        return true;
    }

    if (entry.count >= 30) { // Max 30 adds per minute
        return false;
    }

    entry.count++;
    return true;
}

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ items: [] }, { status: 200 });
    }

    try {
        const sql = getSQL();
        const items = await sql`
            SELECT tmdb_id, title, poster_path, media_type, verdict, added_at 
            FROM watchlist_items 
            WHERE user_id = ${session.user.id} 
            ORDER BY added_at DESC
        `;

        return NextResponse.json({ items });
    } catch (error) {
        console.error("Watchlist GET error:", error);
        return NextResponse.json({ items: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!checkRateLimit(session.user.id)) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const body = await req.json();
        const { tmdb_id, title, poster_path, media_type, verdict } = body;

        // Input sanitization & validation
        const tmdbIdNum = parseInt(String(tmdb_id), 10);
        if (isNaN(tmdbIdNum) || tmdbIdNum <= 0 || tmdbIdNum > 99999999) {
            return NextResponse.json({ error: "Invalid tmdb_id" }, { status: 400 });
        }

        if (!title) {
            return NextResponse.json({ error: "title required" }, { status: 400 });
        }

        const safeTitle = String(title).slice(0, 500);
        const safePosterPath = poster_path ? String(poster_path).slice(0, 500) : null;
        const safeMediaType = ["movie", "tv"].includes(media_type) ? media_type : "movie";
        const safeVerdict = verdict ? String(verdict).slice(0, 30) : null;

        const sql = getSQL();

        // Limit watchlist size per user (max 100)
        const countResult = await sql`
            SELECT COUNT(*) as total FROM watchlist_items 
            WHERE user_id = ${session.user.id}
        `;
        const currentCount = parseInt((countResult[0] as any)?.total || "0", 10);
        if (currentCount >= 100) {
            return NextResponse.json(
                { error: "Watchlist limit reached (100 movies)" },
                { status: 400 }
            );
        }

        // Upsert — if already exists, update verdict (might have changed)
        await sql`
            INSERT INTO watchlist_items (user_id, tmdb_id, title, poster_path, media_type, verdict)
            VALUES (${session.user.id}, ${tmdbIdNum}, ${safeTitle}, ${safePosterPath}, ${safeMediaType}, ${safeVerdict})
            ON CONFLICT (user_id, tmdb_id) 
            DO UPDATE SET verdict = EXCLUDED.verdict, title = EXCLUDED.title, poster_path = EXCLUDED.poster_path
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Watchlist POST error:", error);
        return NextResponse.json({ error: "Failed to add" }, { status: 500 });
    }
}