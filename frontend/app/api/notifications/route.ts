/**
 * Worth the Watch? — Notifications API
 * GET /api/notifications — Fetch user's notifications
 * PATCH /api/notifications — Mark notifications as read
 *
 * Requires authentication.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    try {
        const sql = getSQL();

        await sql`
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                type VARCHAR(30) NOT NULL,
                title TEXT NOT NULL,
                body TEXT,
                tmdb_id INTEGER,
                read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_notifications_user
            ON notifications(user_id, created_at DESC)
        `;

        const notifications = await sql`
            SELECT id, type, title, body, tmdb_id, read, created_at
            FROM notifications
            WHERE user_id = ${session.user.id}
            ORDER BY created_at DESC
            LIMIT 20
        `;

        const unreadResult = await sql`
            SELECT COUNT(*) as count FROM notifications
            WHERE user_id = ${session.user.id} AND read = false
        `;
        const unreadCount = parseInt((unreadResult[0] as any)?.count || "0", 10);

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error("Notifications GET error:", error);
        return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { notification_id, mark_all_read } = body;

        const sql = getSQL();

        if (mark_all_read) {
            await sql`
                UPDATE notifications SET read = true
                WHERE user_id = ${session.user.id} AND read = false
            `;
        } else if (notification_id) {
            await sql`
                UPDATE notifications SET read = true
                WHERE id = ${notification_id} AND user_id = ${session.user.id}
            `;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Notifications PATCH error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }
}
