import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { ipAddress } from "@vercel/functions";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PROXY_SECRET = process.env.INTERNAL_PROXY_SECRET || "";
const ANON_COOKIE = "wtw_anon_id";
const ANON_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

export async function resolveActor(req: NextRequest) {
    const session = await auth();
    const cookieStore = await cookies();
    const clientIp = ipAddress(req) || "unknown";

    let actorType: "user" | "anon";
    let actorId: string;
    let setCookie: { name: string; value: string; options: object } | null = null;

    if (session?.user?.id) {
        actorType = "user";
        actorId = session.user.id;
    } else {
        actorType = "anon";
        const existing = cookieStore.get(ANON_COOKIE)?.value;
        if (existing) {
            actorId = existing;
        } else {
            actorId = randomUUID();
            setCookie = {
                name: ANON_COOKIE,
                value: actorId,
                options: {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax" as const,
                    maxAge: ANON_COOKIE_MAX_AGE,
                    path: "/",
                },
            };
        }
    }

    return { actorType, actorId, clientIp, setCookie, signedIn: actorType === "user" };
}

export function buildProxyHeaders(actorType: string, actorId: string, clientIp: string) {
    return {
        "X-WTW-Actor-Type": actorType,
        "X-WTW-Actor-Id": actorId,
        "X-WTW-Client-IP": clientIp,
        "X-WTW-Proxy-Secret": PROXY_SECRET,
    };
}

export { API_BASE };
