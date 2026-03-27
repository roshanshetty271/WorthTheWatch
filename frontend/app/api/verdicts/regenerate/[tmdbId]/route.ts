import { NextRequest, NextResponse } from "next/server";
import { resolveActor, buildProxyHeaders, API_BASE } from "@/lib/verdictProxy";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tmdbId: string }> }
) {
    const { tmdbId } = await params;
    const url = new URL(req.url);
    const mediaType = url.searchParams.get("media_type") || "movie";

    const { actorType, actorId, clientIp, setCookie } = await resolveActor(req);
    const headers = buildProxyHeaders(actorType, actorId, clientIp);

    const upstream = await fetch(
        `${API_BASE}/api/search/regenerate/${tmdbId}?media_type=${mediaType}`,
        { method: "POST", headers }
    );

    const body = await upstream.json().catch(() => ({}));
    const res = NextResponse.json(body, { status: upstream.status });

    if (setCookie) {
        res.cookies.set(setCookie.name, setCookie.value, setCookie.options as any);
    }

    return res;
}
