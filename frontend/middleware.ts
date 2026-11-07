import { NextRequest, NextResponse } from "next/server";

/**
 * Whole-site maintenance switch — one flag.
 *
 *   MAINTENANCE_MODE = "true"  → every route rewrites to /maintenance
 *                    = unset / anything else → normal site (no-op)
 *
 * Toggle in Vercel: set the env var, then redeploy. To bring the site back,
 * set it to "false" (or delete it) and redeploy.
 *
 * The feedback endpoint, NextAuth, and static assets stay reachable so the
 * maintenance page (and its form) work while the backend/DB are down.
 */
export function middleware(req: NextRequest) {
    if (process.env.MAINTENANCE_MODE !== "true") return NextResponse.next();

    // Rewrite (keep the user's URL) to the maintenance page. Everything that
    // used to be allow-listed here is now excluded by the matcher below, so by
    // the time we reach this line the request is a real page route.
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
}

/**
 * The exclusions live in the matcher, NOT in the function body.
 *
 * A path listed here never invokes middleware at all. A path excluded inside
 * the function has already cost a full invocation before we decide to do
 * nothing — and on Vercel Fluid that invocation is billed in Active CPU on
 * every request to the site, assets included. That cost, times a scraper
 * walking the sitemap, is what exhausted the Hobby allowance on 2026-10-30.
 *
 * Keep this list in sync with the paths the maintenance page needs to work.
 */
export const config = {
    matcher: [
        "/((?!api/auth|api/feedback|_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|webmanifest)$).*)",
    ],
};
