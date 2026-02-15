/**
 * Worth the Watch? — Image Proxy
 * GET /api/image-proxy?url=https://image.tmdb.org/t/p/w500/abc.jpg
 * 
 * Proxies external images through our own domain to avoid CORS issues
 * when using html-to-image for share card generation.
 * Only allows TMDB image URLs for security.
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_DOMAINS = [
    "image.tmdb.org",
    "img.omdbapi.com",
];

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get("url");

    if (!url) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    // Security: only allow TMDB and OMDB image domains
    try {
        const parsed = new URL(url);
        if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
            return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "WorthTheWatch/1.0",
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
        }

        const contentType = response.headers.get("content-type") || "image/jpeg";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return NextResponse.json({ error: "Proxy failed" }, { status: 500 });
    }
}