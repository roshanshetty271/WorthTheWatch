/**
 * Worth the Watch? — Account Deletion
 * DELETE /api/account/delete — Remove all user data and the account itself.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function DELETE() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const sql = getSQL();

        // 1. Watchlist items
        await sql`DELETE FROM watchlist_items WHERE user_id = ${userId}`;

        // 2. Watched items
        await sql`DELETE FROM watched_items WHERE user_id = ${userId}`;

        // 3. User lists (user_list_items cascade via FK)
        await sql`DELETE FROM user_lists WHERE user_id = ${userId}`;

        // 4. User activity
        await sql`DELETE FROM user_activity WHERE user_id = ${userId}`;

        // 5. Notifications
        await sql`DELETE FROM notifications WHERE user_id = ${userId}`;

        // 6. Review feedback — anonymize, don't delete
        await sql`UPDATE review_feedback SET user_id = NULL WHERE user_id = ${userId}`;

        // 7. NextAuth accounts
        await sql`DELETE FROM accounts WHERE "userId" = ${userId}`;

        // 8. NextAuth sessions
        await sql`DELETE FROM sessions WHERE "userId" = ${userId}`;

        // 9. NextAuth user record (must be last)
        await sql`DELETE FROM users WHERE id = ${userId}`;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Account deletion error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
