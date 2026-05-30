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

    const { pathname } = req.nextUrl;

    if (
        pathname === "/maintenance" ||
        pathname.startsWith("/api/feedback") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt" ||
        pathname === "/sitemap.xml" ||
        /\.(?:png|jpe?g|gif|svg|webp|ico|txt|xml|webmanifest)$/i.test(pathname)
    ) {
        return NextResponse.next();
    }

    // Rewrite (keep the user's URL) to the maintenance page.
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    return NextResponse.rewrite(url);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
