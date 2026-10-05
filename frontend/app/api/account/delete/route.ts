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

        // Most of these tables are created lazily by the route that first uses them
        // (CREATE TABLE IF NOT EXISTS), so a given database may not have all of them yet.
        // A statement against a missing table aborts the whole transaction below and makes
        // the account impossible to delete, so only touch the tables that exist.
        const [present] = (await sql`
            SELECT
                to_regclass('watchlist_items') IS NOT NULL AS watchlist_items,
                to_regclass('user_lists') IS NOT NULL AS user_lists,
                to_regclass('user_activity') IS NOT NULL AS user_activity,
                to_regclass('notifications') IS NOT NULL AS notifications,
                to_regclass('review_feedback') IS NOT NULL AS review_feedback,
                to_regclass('contact_submissions') IS NOT NULL AS contact_submissions,
                to_regclass('generation_usage_entries') IS NOT NULL AS generation_usage_entries
        `) as Record<string, boolean>[];

        // Run as one transaction. These were nine separate statements, so any failure
        // left the account half-deleted with no way to retry into a clean state — and
        // step 2 referenced `watched_items`, a table that does not exist anywhere in this
        // project, so deletion ALWAYS threw after the watchlist had already been removed.
        // Users lost their saved list and kept their account.
        await sql.transaction([
            // 1. Watchlist items
            ...(present.watchlist_items ? [sql`DELETE FROM watchlist_items WHERE user_id = ${userId}`] : []),

            // 2. User lists (user_list_items cascade via FK)
            ...(present.user_lists ? [sql`DELETE FROM user_lists WHERE user_id = ${userId}`] : []),

            // 3. User activity
            ...(present.user_activity ? [sql`DELETE FROM user_activity WHERE user_id = ${userId}`] : []),

            // 4. Notifications
            ...(present.notifications ? [sql`DELETE FROM notifications WHERE user_id = ${userId}`] : []),

            // 5. Review feedback — anonymize, don't delete
            ...(present.review_feedback ? [sql`UPDATE review_feedback SET user_id = NULL WHERE user_id = ${userId}`] : []),

            // 6. Contact messages — keep the message, drop the link to the account
            ...(present.contact_submissions ? [sql`UPDATE contact_submissions SET user_id = NULL WHERE user_id = ${userId}`] : []),

            // 7. Generation quota history (backend table; actor_id is the user id)
            ...(present.generation_usage_entries
                ? [sql`DELETE FROM generation_usage_entries WHERE actor_type = 'user' AND actor_id = ${userId}`]
                : []),

            // 8. NextAuth accounts
            sql`DELETE FROM accounts WHERE "userId" = ${userId}`,

            // 9. NextAuth sessions
            sql`DELETE FROM sessions WHERE "userId" = ${userId}`,

            // 10. NextAuth user record (must be last)
            sql`DELETE FROM users WHERE id = ${userId}`,
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Account deletion error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}
