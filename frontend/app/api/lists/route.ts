/**
 * Worth the Watch? — Custom Lists API
 * GET /api/lists — Fetch user's custom lists
 * POST /api/lists — Create a new list
 * PATCH /api/lists — Update a list (name, description, public)
 * DELETE /api/lists — Delete a list
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

async function ensureTables() {
    const sql = getSQL();
    await sql`
        CREATE TABLE IF NOT EXISTS user_lists (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT DEFAULT '',
            is_public BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS user_list_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            list_id UUID NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
            tmdb_id INTEGER NOT NULL,
            title VARCHAR(500) DEFAULT '',
            poster_path VARCHAR(500),
            media_type VARCHAR(10) DEFAULT 'movie',
            verdict VARCHAR(30),
            position INTEGER DEFAULT 0,
            added_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(list_id, tmdb_id)
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS idx_user_lists_user ON user_lists(user_id)
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS idx_list_items_list ON user_list_items(list_id, position)
    `;
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await ensureTables();
        const sql = getSQL();

        const lists = await sql`
            SELECT l.id, l.name, l.description, l.is_public, l.created_at,
                   COUNT(li.id) as item_count
            FROM user_lists l
            LEFT JOIN user_list_items li ON li.list_id = l.id
            WHERE l.user_id = ${session.user.id}
            GROUP BY l.id
            ORDER BY l.created_at DESC
        `;

        return NextResponse.json({ lists });
    } catch (error) {
        console.error("Lists GET error:", error);
        return NextResponse.json({ lists: [] }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        await ensureTables();
        const sql = getSQL();

        const body = await req.json();
        const name = String(body.name || "").slice(0, 200).trim();
        const description = String(body.description || "").slice(0, 1000).trim();
        const isPublic = !!body.is_public;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        // Max 10 lists per user
        const countResult = await sql`
            SELECT COUNT(*) as total FROM user_lists WHERE user_id = ${session.user.id}
        `;
        if (parseInt((countResult[0] as any)?.total || "0", 10) >= 10) {
            return NextResponse.json({ error: "Maximum 10 lists allowed" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO user_lists (user_id, name, description, is_public)
            VALUES (${session.user.id}, ${name}, ${description}, ${isPublic})
            RETURNING id, name, description, is_public, created_at
        `;

        return NextResponse.json({ list: result[0] });
    } catch (error) {
        console.error("Lists POST error:", error);
        return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sql = getSQL();
        const body = await req.json();
        const { list_id, name, description, is_public } = body;

        if (!list_id) {
            return NextResponse.json({ error: "list_id required" }, { status: 400 });
        }

        // Verify ownership
        const owned = await sql`
            SELECT id FROM user_lists WHERE id = ${list_id} AND user_id = ${session.user.id}
        `;
        if (owned.length === 0) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        if (name !== undefined) {
            await sql`UPDATE user_lists SET name = ${String(name).slice(0, 200)} WHERE id = ${list_id}`;
        }
        if (description !== undefined) {
            await sql`UPDATE user_lists SET description = ${String(description).slice(0, 1000)} WHERE id = ${list_id}`;
        }
        if (is_public !== undefined) {
            await sql`UPDATE user_lists SET is_public = ${!!is_public} WHERE id = ${list_id}`;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Lists PATCH error:", error);
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
        const { list_id } = body;

        if (!list_id) {
            return NextResponse.json({ error: "list_id required" }, { status: 400 });
        }

        await sql`
            DELETE FROM user_lists WHERE id = ${list_id} AND user_id = ${session.user.id}
        `;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Lists DELETE error:", error);
        return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }
}
