/**
 * Worth the Watch? — Activity History API
 * GET /api/history — Fetch user's activity log
 * POST /api/history — Log an activity event
 *
 * Requires authentication. Returns 401 if not signed in.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

    try {
        const sql = getSQL();

        await sql`
            CREATE TABLE IF NOT EXISTS user_activity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                activity_type VARCHAR(20) NOT NULL,
                tmdb_id INTEGER NOT NULL,
                media_type VARCHAR(10) DEFAULT 'movie',
                title VARCHAR(500) DEFAULT '',
                poster_path VARCHAR(500),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_user_activity_user
            ON user_activity(user_id, created_at DESC)
        `;

        const activities = await sql`
            SELECT id, activity_type, tmdb_id, media_type, title, poster_path, metadata, created_at
            FROM user_activity
            WHERE user_id = ${session.user.id}
            ORDER BY created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        const countResult = await sql`
            SELECT COUNT(*) as total FROM user_activity WHERE user_id = ${session.user.id}
        `;
        const total = parseInt((countResult[0] as any)?.total || "0", 10);

        return NextResponse.json({ activities, total });
    } catch (error) {
        console.error("History GET error:", error);
        return NextResponse.json({ activities: [], total: 0 }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { activity_type, tmdb_id, media_type, title, poster_path } = body;

        const validTypes = ["view", "generate", "battle", "roulette"];
        if (!validTypes.includes(activity_type)) {
            return NextResponse.json({ error: "Invalid activity_type" }, { status: 400 });
        }

        const tmdbIdNum = parseInt(String(tmdb_id), 10);
        if (isNaN(tmdbIdNum) || tmdbIdNum <= 0) {
            return NextResponse.json({ error: "Invalid tmdb_id" }, { status: 400 });
        }

        const safeMediaType = ["movie", "tv"].includes(media_type) ? media_type : "movie";
        const safeTitle = title ? String(title).slice(0, 500) : "";
        const safePoster = poster_path ? String(poster_path).slice(0, 500) : null;

        const sql = getSQL();

        await sql`
            CREATE TABLE IF NOT EXISTS user_activity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                activity_type VARCHAR(20) NOT NULL,
                tmdb_id INTEGER NOT NULL,
                media_type VARCHAR(10) DEFAULT 'movie',
                title VARCHAR(500) DEFAULT '',
                poster_path VARCHAR(500),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;

        // Deduplicate: don't log the same view twice within 5 minutes
        if (activity_type === "view") {
            const recent = await sql`
                SELECT id FROM user_activity
                WHERE user_id = ${session.user.id}
                    AND activity_type = 'view'
                    AND tmdb_id = ${tmdbIdNum}
                    AND created_at > NOW() - INTERVAL '5 minutes'
                LIMIT 1
            `;
            if (recent.length > 0) {
                return NextResponse.json({ success: true, deduplicated: true });
            }
        }

        await sql`
            INSERT INTO user_activity (user_id, activity_type, tmdb_id, media_type, title, poster_path)
            VALUES (${session.user.id}, ${activity_type}, ${tmdbIdNum}, ${safeMediaType}, ${safeTitle}, ${safePoster})
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("History POST error:", error);
        return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
    }
}
