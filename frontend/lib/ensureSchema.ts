/**
 * Worth the Watch? — one-time schema guards.
 *
 * These ALTERs used to run on every request. `ADD COLUMN IF NOT EXISTS` still takes an
 * ACCESS EXCLUSIVE lock on the table even when the column is already there, so concurrent
 * requests serialised behind a lock on the Auth.js `users` table and stalled sign-ins. It
 * also woke the Neon compute on every single call.
 *
 * Memoised per process: at most one run per cold start, never on the hot path after that.
 * A failure clears the memo so the next request retries instead of caching the failure.
 */
// Structural type: any neon tagged-template query function, whatever its generics.
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;

let usersColumns: Promise<void> | null = null;
let watchlistColumns: Promise<void> | null = null;

export function ensureUserDigestColumns(sql: Sql): Promise<void> {
    if (!usersColumns) {
        usersColumns = (async () => {
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS digest_frequency VARCHAR(10) DEFAULT 'monthly'`;
            await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP`;
        })().catch((err) => {
            usersColumns = null;
            throw err;
        });
    }
    return usersColumns;
}

export function ensureWatchlistStatusColumn(sql: Sql): Promise<void> {
    if (!watchlistColumns) {
        watchlistColumns = (async () => {
            await sql`ALTER TABLE watchlist_items ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'want_to_watch'`;
        })().catch((err) => {
            watchlistColumns = null;
            throw err;
        });
    }
    return watchlistColumns;
}
