import { NextRequest, NextResponse } from "next/server";
import { resolveActor, buildProxyHeaders, API_BASE } from "@/lib/verdictProxy";

export async function GET(req: NextRequest) {
    const { actorType, actorId, clientIp, setCookie, signedIn } = await resolveActor(req);
    const headers = buildProxyHeaders(actorType, actorId, clientIp);

    const upstream = await fetch(`${API_BASE}/api/search/quota`, { headers });
    let quota: Record<string, unknown>;

    if (upstream.ok) {
        quota = await upstream.json();
    } else {
        // Quota endpoint doesn't exist yet on FastAPI — compute client-side from proxy headers
        // This is a temporary fallback; the real quota comes from the generate/regenerate responses
        quota = {
            actorType,
            signedIn,
            limit: actorType === "user" ? 20 : 3,
            used: 0,
            remaining: actorType === "user" ? 20 : 3,
            windowType: actorType === "user" ? "rolling_24h" : "lifetime",
            exhausted: false,
        };
    }

    const res = NextResponse.json({ ...quota, signedIn });

    if (setCookie) {
        res.cookies.set(setCookie.name, setCookie.value, setCookie.options as any);
    }

    return res;
}
