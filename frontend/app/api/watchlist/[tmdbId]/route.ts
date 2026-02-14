/**
 * Worth the Watch? — Watchlist Delete API
 * DELETE /api/watchlist/[tmdbId] — Remove item from watchlist
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ tmdbId: string }> }
) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tmdbId } = await params;
    const tmdbIdNum = parseInt(tmdbId, 10);

    if (isNaN(tmdbIdNum) || tmdbIdNum <= 0 || tmdbIdNum > 99999999) {
        return NextResponse.json({ error: "Invalid tmdb_id" }, { status: 400 });
    }

    try {
        const sql = neon(process.env.DATABASE_URL!);

        await sql`
            DELETE FROM watchlist_items 
            WHERE user_id = ${session.user.id} AND tmdb_id = ${tmdbIdNum}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Watchlist DELETE error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}