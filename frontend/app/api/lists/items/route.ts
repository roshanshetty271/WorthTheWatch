/**
 * Worth the Watch? — List Items API
 * GET /api/lists/items?list_id=... — Fetch items in a list
 * POST /api/lists/items — Add item to a list
 * DELETE /api/lists/items — Remove item from a list
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get("list_id");

    if (!listId) {
        return NextResponse.json({ error: "list_id required" }, { status: 400 });
    }

    try {
        const sql = getSQL();

        // Check if list is public or owned by the user
        const session = await auth();
        const list = await sql`
            SELECT id, user_id, name, description, is_public FROM user_lists WHERE id = ${listId}
        `;

        if (list.length === 0) {
            return NextResponse.json({ error: "List not found" }, { status: 404 });
        }

        const listData = list[0];
        const isOwner = session?.user?.id === listData.user_id;
        if (!listData.is_public && !isOwner) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 });
        }

        const items = await sql`
            SELECT tmdb_id, title, poster_path, media_type, verdict, position, added_at
            FROM user_list_items
            WHERE list_id = ${listId}
            ORDER BY position ASC, added_at DESC
        `;

        return NextResponse.json({
            list: {
                id: listData.id,
                name: listData.name,
                description: listData.description,
                is_public: listData.is_public,
                isOwner,
            },
            items,
        });
    } catch (error) {
        console.error("List items GET error:", error);
        return NextResponse.json({ items: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sql = getSQL();
        const body = await req.json();
        const { list_id, tmdb_id, title, poster_path, media_type, verdict } = body;

        if (!list_id || !tmdb_id) {
            return NextResponse.json({ error: "list_id and tmdb_id required" }, { status: 400 });
        }

        // Verify ownership
        const owned = await sql`
            SELECT id FROM user_lists WHERE id = ${list_id} AND user_id = ${session.user.id}
        `;
        if (owned.length === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // Max 50 items per list
        const countResult = await sql`
            SELECT COUNT(*) as total FROM user_list_items WHERE list_id = ${list_id}
        `;
        if (parseInt((countResult[0] as any)?.total || "0", 10) >= 50) {
            return NextResponse.json({ error: "Maximum 50 items per list" }, { status: 400 });
        }

        const maxPos = await sql`
            SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM user_list_items WHERE list_id = ${list_id}
        `;

        await sql`
            INSERT INTO user_list_items (list_id, tmdb_id, title, poster_path, media_type, verdict, position)
            VALUES (${list_id}, ${parseInt(String(tmdb_id), 10)}, ${String(title || "").slice(0, 500)}, 
                    ${poster_path ? String(poster_path).slice(0, 500) : null},
                    ${["movie", "tv"].includes(media_type) ? media_type : "movie"},
                    ${verdict ? String(verdict).slice(0, 30) : null},
                    ${(maxPos[0] as any)?.next_pos || 0})
            ON CONFLICT (list_id, tmdb_id) DO NOTHING
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("List items POST error:", error);
        return NextResponse.json({ error: "Failed to add" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sql = getSQL();
        const body = await req.json();
        const { list_id, tmdb_id } = body;

        if (!list_id || !tmdb_id) {
            return NextResponse.json({ error: "list_id and tmdb_id required" }, { status: 400 });
        }

        // Verify ownership
        const owned = await sql`
            SELECT id FROM user_lists WHERE id = ${list_id} AND user_id = ${session.user.id}
        `;
        if (owned.length === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        await sql`
            DELETE FROM user_list_items WHERE list_id = ${list_id} AND tmdb_id = ${parseInt(String(tmdb_id), 10)}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("List items DELETE error:", error);
        return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
    }
}
