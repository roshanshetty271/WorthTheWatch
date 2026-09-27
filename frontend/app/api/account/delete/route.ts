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

        // Run as one transaction. These were nine separate statements, so any failure
        // left the account half-deleted with no way to retry into a clean state — and
        // step 2 referenced `watched_items`, a table that does not exist anywhere in this
        // project, so deletion ALWAYS threw after the watchlist had already been removed.
        // Users lost their saved list and kept their account.
        await sql.transaction([
            // 1. Watchlist items
            sql`DELETE FROM watchlist_items WHERE user_id = ${userId}`,

            // 2. User lists (user_list_items cascade via FK)
            sql`DELETE FROM user_lists WHERE user_id = ${userId}`,

            // 3. User activity
            sql`DELETE FROM user_activity WHERE user_id = ${userId}`,

            // 4. Notifications
            sql`DELETE FROM notifications WHERE user_id = ${userId}`,

            // 5. Review feedback — anonymize, don't delete
            sql`UPDATE review_feedback SET user_id = NULL WHERE user_id = ${userId}`,

            // 6. NextAuth accounts
            sql`DELETE FROM accounts WHERE "userId" = ${userId}`,

            // 7. NextAuth sessions
            sql`DELETE FROM sessions WHERE "userId" = ${userId}`,

            // 8. NextAuth user record (must be last)
            sql`DELETE FROM users WHERE id = ${userId}`,
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Account deletion error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
