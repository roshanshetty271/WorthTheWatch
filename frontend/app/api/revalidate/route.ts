/**
 * Worth the Watch? — Cache Revalidation
 * POST /api/revalidate?path=/movie/12345
 *
 * Called after a review is generated to invalidate the server-side
 * cache so navigating back shows the fresh review instead of
 * "Generate Review" button.
 */
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

const revalidateLog = new Map<string, number[]>();
const MAX_PER_MINUTE = 10;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
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

    const path = req.nextUrl.searchParams.get("path");

    if (!path || (!/^\/movie\/\d+$/.test(path) && path !== "/")) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    revalidatePath(path);
    if (path !== "/") {
        revalidatePath("/");
    }

    return NextResponse.json({ revalidated: true });
}