/**
 * Worth the Watch? — Personalized Recommendations API
 * GET /api/recommendations — returns movies matching the user's taste
 *
 * Strategy: fetch user's top genres from profile, get reviewed movies from
 * backend, filter out already-seen/saved, sort by genre overlap.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ movies: [] });
    }

    try {
        const sql = getSQL();

        // Get tmdb_ids the user has already interacted with
        const seenActivities = await sql`
            SELECT DISTINCT tmdb_id FROM user_activity WHERE user_id = ${session.user.id}
        `;
        const savedItems = await sql`
            SELECT DISTINCT tmdb_id FROM watchlist_items WHERE user_id = ${session.user.id}
        `;

        const seenIds = new Set<number>();
        for (const row of [...seenActivities, ...savedItems]) {
            seenIds.add(row.tmdb_id as number);
        }

        // Fetch reviewed movies from backend (multiple pages to get variety)
        const allMovies: any[] = [];
        for (let page = 1; page <= 3; page++) {
            try {
                const res = await fetch(`${API_BASE}/api/movies?page=${page}&limit=50`, {
                    next: { revalidate: 1800 },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.movies) allMovies.push(...data.movies);
                }
            } catch {
                break;
            }
        }

        // Filter out movies the user has already seen
        const unseen = allMovies.filter(
            (m: any) => m.movie && !seenIds.has(m.movie.tmdb_id)
        );

        // Learn taste genres from BOTH the user's activity AND their saved list.
        // A save is a stronger signal of intent than a passing view, so weight it double.
        const savedSet = new Set<number>(savedItems.map((r: any) => r.tmdb_id as number));
        const tasteIds = Array.from(
            new Set<number>([
                ...savedItems.map((r: any) => r.tmdb_id as number),
                ...seenActivities.map((r: any) => r.tmdb_id as number),
            ])
        ).slice(0, 40);

        const genreCounts: Record<string, number> = {};
        if (tasteIds.length > 0) {
            // One query against the shared movies table — no per-id HTTP fan-out.
            const rows = await sql`
                SELECT tmdb_id, genres FROM movies WHERE tmdb_id = ANY(${tasteIds})
            `;
            for (const row of rows) {
                const genres = (row as any).genres;
                if (!Array.isArray(genres)) continue;
                const weight = savedSet.has((row as any).tmdb_id as number) ? 2 : 1; // saved counts double
                for (const g of genres) {
                    const name = typeof g === "string" ? g : g?.name;
                    if (typeof name === "string" && name) {
                        genreCounts[name] = (genreCounts[name] || 0) + weight;
                    }
                }
            }
        }

        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);

        // Score each unseen movie by genre overlap with user's top genres
        const scored = unseen.map((m: any) => {
            const movieGenres: string[] = (m.movie?.genres || []).map((g: any) =>
                typeof g === "string" ? g : g.name || ""
            );
            const overlap = movieGenres.filter((g: string) => topGenres.includes(g)).length;
            return { ...m, _score: overlap };
        });

        scored.sort((a: any, b: any) => b._score - a._score);

        // Return top 10 recommendations, with WORTH IT movies prioritized
        const worthIt = scored.filter((m: any) => m.review?.verdict === "WORTH IT");
        const others = scored.filter((m: any) => m.review?.verdict !== "WORTH IT");
        const combined = [...worthIt, ...others].slice(0, 10);

        const movies = combined.map(({ _score, ...rest }: any) => rest);

        return NextResponse.json({ movies });
    } catch (error) {
        console.error("Recommendations error:", error);
        return NextResponse.json({ movies: [] }, { status: 500 });
    }
}
