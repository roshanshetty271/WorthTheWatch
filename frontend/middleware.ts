import { NextRequest, NextResponse } from "next/server";

/**
 * Whole-site maintenance switch.
 *
 * Flip with the MAINTENANCE_MODE env var in Vercel (then redeploy):
 *   MAINTENANCE_MODE=true   → every page rewrites to /maintenance
 *   unset / anything else   → normal site, this middleware is a no-op
 *
 * The feedback endpoint and static assets stay reachable so the maintenance
 * page (and its form) actually work while the backend/DB are down.
 */
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";

export function middleware(req: NextRequest) {
    if (!MAINTENANCE_MODE) return NextResponse.next();

    const { pathname } = req.nextUrl;

    // Allow the maintenance page itself, the email-only feedback API, and assets.
    if (
        pathname === "/maintenance" ||
        pathname.startsWith("/api/feedback") ||
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
    // Run on everything except Next internals/image optimizer and favicon.
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
