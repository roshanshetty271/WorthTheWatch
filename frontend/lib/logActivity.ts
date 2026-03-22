/**
 * Fire-and-forget activity logger for signed-in users.
 * Calls POST /api/history — failures are silently ignored.
 */
export function logActivity(params: {
    activity_type: "view" | "generate" | "battle" | "roulette";
    tmdb_id: number;
    media_type?: string;
    title?: string;
    poster_path?: string | null;
}) {
    fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    }).catch(() => {});
}
