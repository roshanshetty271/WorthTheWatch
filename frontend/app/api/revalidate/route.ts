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

export async function POST(req: NextRequest) {
    const path = req.nextUrl.searchParams.get("path");

    if (path) {
        // Revalidate the specific movie page
        revalidatePath(path);
        // Also revalidate homepage so hero + latest section update
        revalidatePath("/");
    }

    return NextResponse.json({ revalidated: true });
}