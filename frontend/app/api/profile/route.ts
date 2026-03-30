/**
 * Worth the Watch? — Taste Profile API
 * GET /api/profile — Analyze user's taste from activity + watchlist
 *
 * Requires authentication. Queries the backend DB for genre data.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { neon } from "@neondatabase/serverless";

function getSQL() {
    return neon(process.env.DATABASE_URL!);
}

interface GenreCount {
    name: string;
    count: number;
}

export async function GET() {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const sql = getSQL();

        // Get user's activity stats
        const activityStats = await sql`
            SELECT activity_type, COUNT(*) as count
            FROM user_activity
            WHERE user_id = ${session.user.id}
            GROUP BY activity_type
        `;

        // Get unique movies from both watchlist and activity
        const watchlistItems = await sql`
            SELECT DISTINCT tmdb_id, media_type FROM watchlist_items
            WHERE user_id = ${session.user.id}
        `;

        const activityItems = await sql`
            SELECT DISTINCT tmdb_id, media_type FROM user_activity
            WHERE user_id = ${session.user.id}
        `;

        // Combine unique tmdb_ids
        const allTmdbIds = new Set<number>();
        for (const item of [...watchlistItems, ...activityItems]) {
            allTmdbIds.add(item.tmdb_id as number);
        }

        // Fetch genre + decade data directly from DB (1 query instead of 50 API calls)
        const genreCounts: Record<string, number> = {};
        const decadeCounts: Record<string, number> = {};
        let totalMovies = 0;
        let totalTv = 0;

        const idsArray = Array.from(allTmdbIds);
        if (idsArray.length > 0) {
            const movieRows = await sql`
                SELECT tmdb_id, media_type, genres, release_date
                FROM movies
                WHERE tmdb_id = ANY(${idsArray})
            `;

            for (const row of movieRows) {
                // Count media types
                if (row.media_type === "tv") totalTv++;
                else totalMovies++;

                // Count genres
                const genres = row.genres;
                if (Array.isArray(genres)) {
                    for (const genre of genres) {
                        const name = typeof genre === "string" ? genre : genre?.name;
                        if (typeof name === "string" && name) {
                            genreCounts[name] = (genreCounts[name] || 0) + 1;
                        }
                    }
                }

                // Count decades
                if (row.release_date) {
                    const year = new Date(row.release_date).getFullYear();
                    if (!isNaN(year)) {
                        const decade = `${Math.floor(year / 10) * 10}s`;
                        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
                    }
                }
            }
        }

        // Sort genres by count
        const topGenres: GenreCount[] = Object.entries(genreCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        // Sort decades
        const topDecades = Object.entries(decadeCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Build stats
        const stats: Record<string, number> = {};
        for (const row of activityStats) {
            stats[row.activity_type as string] = row.count as number;
        }

        // Total items interacted with
        const totalActivity = await sql`
            SELECT COUNT(*) as total FROM user_activity WHERE user_id = ${session.user.id}
        `;

        return NextResponse.json({
            topGenres,
            topDecades,
            stats: {
                views: stats.view || 0,
                generations: stats.generate || 0,
                battles: stats.battle || 0,
                rouletteSpins: stats.roulette || 0,
                totalActivity: parseInt((totalActivity[0] as any)?.total || "0", 10),
                savedMovies: watchlistItems.length,
                moviesVsTv: { movies: totalMovies, tv: totalTv },
            },
            userName: session.user.name || "Movie Fan",
            userImage: session.user.image || null,
        });
    } catch (error) {
        console.error("Profile GET error:", error);
        return NextResponse.json({ error: "Failed to build profile" }, { status: 500 });
    }
}
