import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import type { PaginatedMovies } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Category Metadata ─────────────────────────────────────────
const CATEGORY_META: Record<string, { title: string; description: string; emoji: string }> = {
    "trending": { title: "Trending This Week", description: "What everyone's watching right now", emoji: "🔥" },
    "latest": { title: "Latest Reviews", description: "Freshly reviewed movies and shows", emoji: "🆕" },
    "worth-it": { title: "Certified Worth It", description: "The internet says these are worth your time", emoji: "✅" },
    "skip-these": { title: "Skip These", description: "Save your time — the internet has spoken", emoji: "❌" },
    "mixed-bag": { title: "The Internet Is Divided", description: "Love it or hate it — no middle ground", emoji: "⚖️" },
    "hidden-gems": { title: "Hidden Gems", description: "Under-the-radar picks the internet quietly loves", emoji: "💎" },
    "movies": { title: "Movies", description: "All reviewed movies", emoji: "🎬" },
    "tv-shows": { title: "TV Shows", description: "All reviewed TV shows", emoji: "📺" },
};

const VALID_CATEGORIES = Object.keys(CATEGORY_META);

// ─── SEO Metadata ──────────────────────────────────────────────
export async function generateMetadata({
    params,
}: {
    params: Promise<{ category: string }>;
}): Promise<Metadata> {
    const { category } = await params;
    const meta = CATEGORY_META[category];

    if (!meta) {
        return { title: "Not Found | Worth the Watch?" };
    }

    return {
        title: `${meta.emoji} ${meta.title} | Worth the Watch?`,
        description: meta.description,
        openGraph: {
            title: `${meta.title} | Worth the Watch?`,
            description: meta.description,
        },
    };
}

// ─── Data Fetching ─────────────────────────────────────────────
async function getMovies(category: string, page: number): Promise<PaginatedMovies | null> {
    try {
        const res = await fetch(
            `${API_BASE}/api/movies?category=${category}&page=${page}&limit=20`,
            { next: { revalidate: 60 } }
        );
        if (!res.ok) return null;
        return res.json();
    } catch {
        return null;
    }
}

// ─── Page Component ────────────────────────────────────────────
export default async function BrowsePage({
    params,
    searchParams,
}: {
    params: Promise<{ category: string }>;
    searchParams: Promise<{ page?: string }>;
}) {
    const { category } = await params;
    const { page: pageParam } = await searchParams;

    // Validate category
    if (!VALID_CATEGORIES.includes(category)) {
        notFound();
    }

    const meta = CATEGORY_META[category];
    const page = Math.max(1, parseInt(pageParam || "1", 10));
    const data = await getMovies(category, page);
    const movies = data?.movies ?? [];
    const totalPages = data?.pages ?? 0;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 pt-24 sm:px-6">
            {/* Back Link */}
            <Link
                href="/"
                className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary transition-colors mb-6"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Home
            </Link>

            {/* Header */}
            <header className="mb-8">
                <h1 className="font-display text-3xl text-text-primary sm:text-4xl">
                    {meta.emoji} {meta.title}
                </h1>
                <p className="mt-2 text-text-secondary">{meta.description}</p>
            </header>

            {/* Movie Grid */}
            {movies.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6">
                    {movies.map((item) => (
                        <MovieCard key={item.movie.tmdb_id} data={item} />
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-surface-elevated bg-surface-card p-12 text-center">
                    <p className="text-5xl mb-4">{meta.emoji}</p>
                    <h2 className="font-display text-xl text-text-primary mb-2">
                        No {meta.title.toLowerCase()} yet
                    </h2>
                    <p className="text-text-secondary text-sm">
                        Check back later or search for movies to add reviews.
                    </p>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-4">
                    {/* Previous */}
                    {page > 1 ? (
                        <Link
                            href={`/browse/${category}?page=${page - 1}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </Link>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-surface-card/50 px-4 py-2 text-sm font-medium text-text-muted cursor-not-allowed">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            Previous
                        </span>
                    )}

                    {/* Page indicator */}
                    <span className="text-sm text-text-muted">
                        Page {page} of {totalPages}
                    </span>

                    {/* Next */}
                    {page < totalPages ? (
                        <Link
                            href={`/browse/${category}?page=${page + 1}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                        >
                            Next
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-surface-card/50 px-4 py-2 text-sm font-medium text-text-muted cursor-not-allowed">
                            Next
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                    )}
                </nav>
            )}
        </div>
    );
}
