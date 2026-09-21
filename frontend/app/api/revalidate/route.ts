/**
 * Worth the Watch? — Cache Revalidation
 * POST /api/revalidate?path=/movie/12345
 *
 * Called after a review is generated to invalidate the server-side
 * cache so navigating back shows the fresh review instead of
 * "Generate Review" button.
 *
 * Also called by the backend stats cron, which sweeps up to 200 movies per run
 * and would blow straight through the per-IP rate limit. A request carrying the
 * shared CRON_SECRET skips the limit, and can pass skipHome=1 so a bulk sweep
 * doesn't rebuild the homepage once per movie.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";

const revalidateLog = new Map<string, number[]>();
const MAX_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

/** Constant-time secret comparison; false when either side is missing. */
function isCronRequest(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    const provided = req.headers.get("x-cron-secret");
    if (!expected || !provided) return false;

    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    // timingSafeEqual throws on length mismatch, so guard it first. The length
    // itself is not secret.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
    const isCron = isCronRequest(req);

    if (!isCron) {
        const ip =
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const now = Date.now();

        const timestamps = (revalidateLog.get(ip) || []).filter(
            (t) => now - t < WINDOW_MS
        );
        if (timestamps.length >= MAX_PER_MINUTE) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }
        timestamps.push(now);
        revalidateLog.set(ip, timestamps);
    }

    const path = req.nextUrl.searchParams.get("path");

    if (!path || (!/^\/movie\/\d+$/.test(path) && path !== "/")) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    revalidatePath(path);

    // Bulk sweeps opt out of the homepage rebuild and revalidate "/" once at the end.
    const skipHome = req.nextUrl.searchParams.get("skipHome") === "1";
    if (path !== "/" && !skipHome) {
        revalidatePath("/");
    }

    return NextResponse.json({ revalidated: true });
}