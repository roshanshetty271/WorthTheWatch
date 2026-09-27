/**
 * Worth the Watch? — Review feedback proxy
 * GET  /api/reviews/:tmdbId/feedback — read aggregate + this actor's vote
 * POST /api/reviews/:tmdbId/feedback — cast or change this actor's vote
 *
 * The browser used to call the backend directly and pass its own user_id, which meant
 * anyone could read or overwrite another user's vote by guessing an id. Identity is now
 * resolved server-side from the NextAuth session (or the httpOnly anon cookie) and
 * asserted to the backend with the shared proxy secret, exactly like the verdict routes.
 */
import { NextRequest, NextResponse } from "next/server";
import { resolveActor, buildProxyHeaders, API_BASE } from "@/lib/verdictProxy";

async function forward(req: NextRequest, tmdbId: string, init?: RequestInit) {
    const { actorType, actorId, clientIp, setCookie } = await resolveActor(req);
    const headers = {
        ...buildProxyHeaders(actorType, actorId, clientIp),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
    };

    const upstream = await fetch(`${API_BASE}/api/reviews/${tmdbId}/feedback`, {
        ...init,
        headers,
    });

    const body = await upstream.json().catch(() => ({}));
    const res = NextResponse.json(body, { status: upstream.status });

    if (setCookie) {
        res.cookies.set(setCookie.name, setCookie.value, setCookie.options as any);
    }

    return res;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ tmdbId: string }> }
) {
    const { tmdbId } = await params;
    return forward(req, tmdbId);
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ tmdbId: string }> }
) {
    const { tmdbId } = await params;
    const incoming = await req.json().catch(() => ({}));

    // Only `helpful` is taken from the client. Any user_id in the body is ignored.
    return forward(req, tmdbId, {
        method: "POST",
        body: JSON.stringify({ helpful: Boolean(incoming?.helpful) }),
    });
}
