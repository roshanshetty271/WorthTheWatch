import { NextRequest, NextResponse } from "next/server";

const WHITELIST = (process.env.RATE_LIMIT_WHITELIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export async function GET(req: NextRequest) {
    if (WHITELIST.length === 0) {
        return NextResponse.json({ whitelisted: false });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";

    return NextResponse.json({ whitelisted: WHITELIST.includes(ip) });
}
