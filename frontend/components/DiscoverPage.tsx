"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DiscoverResult {
    tmdb_id: number;
    title: string;
    media_type: string;
    release_date: string;
    poster_url: string | null;
    overview: string;
    tmdb_vote_average: number | null;
    verdict?: string | null;
    has_review?: boolean;
}

const GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime",
    "Documentary", "Drama", "Family", "Fantasy", "History",
    "Horror", "Music", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western",
];

const YEARS = Array.from({ length: 6 }, (_, i) => 2025 - i);

const DECADES = [
    { label: "2010s", value: "2010" },
    { label: "2000s", value: "2000" },
    { label: "90s", value: "1990" },
    { label: "80s", value: "1980" },
];

const SORT_OPTIONS = [
    { label: "Most Popular", value: "popular" },
    { label: "Highest Rated", value: "rating" },
    { label: "Newest First", value: "newest" },
    { label: "Most Voted", value: "votes" },
];

const RATING_FILTERS = [
    { label: "7+", value: 7 },
    { label: "8+", value: 8 },
    { label: "9+", value: 9 },
];

function PosterImage({ src, alt, sizes = "200px" }: { src: string | null; alt: string; sizes?: string }) {
    const [error, setError] = useState(false);
    if (error || !src) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-white/[0.02] p-3">
                <span className="text-3xl mb-2 opacity-40">🎬</span>
                <span className="text-[10px] text-white/40 text-center line-clamp-2 font-medium">{alt}</span>
            </div>
        );
    }
    return (
        <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={sizes}
            unoptimized
            onError={() => setError(true)}
        />
    );
}

export default function DiscoverPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [mediaType, setMediaType] = useState<"movie" | "tv">(
        (searchParams.get("type") as "movie" | "tv") || "movie"
    );
    const [genre, setGenre] = useState<string | null>(searchParams.get("genre"));
    const [year, setYear] = useState<number | null>(
        searchParams.get("year") ? parseInt(searchParams.get("year")!) : null
    );
    const [minRating, setMinRating] = useState<number | null>(
        searchParams.get("rating") ? parseFloat(searchParams.get("rating")!) : null
    );
    const [sort, setSort] = useState(searchParams.get("sort") || "popular");

    const [results, setResults] = useState<DiscoverResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchResults = useCallback(async (pageNum: number = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("media_type", mediaType);
            params.set("sort", sort);
            params.set("page", String(pageNum));
            params.set("min_votes", "100");
            if (genre) params.set("genre", genre.toLowerCase());
            if (year) params.set("year", String(year));
            if (minRating) params.set("min_rating", String(minRating));

            const res = await fetch(`${API_BASE}/api/discover?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (pageNum === 1) {
                    setResults(data.results || []);
                } else {
                    setResults((prev) => [...prev, ...(data.results || [])]);
                }
                setTotalPages(data.total_pages || 1);
                setPage(pageNum);
            }
        } catch {
            if (pageNum === 1) setResults([]);
        } finally {
            setLoading(false);
        }
    }, [mediaType, genre, year, minRating, sort]);

    useEffect(() => {
        fetchResults(1);
    }, [fetchResults]);

    useEffect(() => {
        const params = new URLSearchParams();
        params.set("type", mediaType);
        if (genre) params.set("genre", genre);
        if (year) params.set("year", String(year));
        if (minRating) params.set("rating", String(minRating));
        if (sort !== "popular") params.set("sort", sort);
        router.replace(`/discover?${params.toString()}`, { scroll: false });
    }, [mediaType, genre, year, minRating, sort, router]);

    const clearFilters = () => {
        setGenre(null);
        setYear(null);
        setMinRating(null);
        setSort("popular");
    };

    const hasFilters = genre || year || minRating || sort !== "popular";

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="pt-28 md:pt-32 pb-2 px-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tighter">
                        <span className="text-white">Discover</span>
                    </h1>
                    <p className="text-white/40 mt-2 text-sm max-w-md">
                        Find exactly what you want to watch. Filter by genre, year, rating, and more.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="sticky top-16 z-30 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 py-4 px-4">
                <div className="max-w-6xl mx-auto space-y-3">

                    {/* Row 1: Media Type + Sort */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-white/5 rounded-full p-0.5">
                            <button
                                onClick={() => setMediaType("movie")}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${mediaType === "movie"
                                        ? "bg-accent-gold text-black"
                                        : "text-white/50 hover:text-white/70"
                                    }`}
                            >
                                Movies
                            </button>
                            <button
                                onClick={() => setMediaType("tv")}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${mediaType === "tv"
                                        ? "bg-accent-gold text-black"
                                        : "text-white/50 hover:text-white/70"
                                    }`}
                            >
                                TV Shows
                            </button>
                        </div>

                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-white/70 focus:outline-none focus:border-accent-gold/50 appearance-none cursor-pointer"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-[10px] uppercase tracking-widest text-accent-gold/70 hover:text-accent-gold transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Row 2: Genre chips */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                        {GENRES.map((g) => (
                            <button
                                key={g}
                                onClick={() => setGenre(genre === g.toLowerCase() ? null : g.toLowerCase())}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${genre === g.toLowerCase()
                                        ? "bg-accent-gold text-black"
                                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    {/* Row 3: Year + Rating chips */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                        {YEARS.map((y) => (
                            <button
                                key={y}
                                onClick={() => setYear(year === y ? null : y)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${year === y
                                        ? "bg-accent-gold text-black"
                                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                                    }`}
                            >
                                {y}
                            </button>
                        ))}

                        <div className="w-px h-6 bg-white/10 self-center shrink-0 mx-1" />

                        {DECADES.map((d) => (
                            <button
                                key={d.value}
                                onClick={() => setYear(year === parseInt(d.value) ? null : parseInt(d.value))}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${year === parseInt(d.value)
                                        ? "bg-accent-gold text-black"
                                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                                    }`}
                            >
                                {d.label}
                            </button>
                        ))}

                        <div className="w-px h-6 bg-white/10 self-center shrink-0 mx-1" />

                        {RATING_FILTERS.map((r) => (
                            <button
                                key={r.value}
                                onClick={() => setMinRating(minRating === r.value ? null : r.value)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${minRating === r.value
                                        ? "bg-accent-gold text-black"
                                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                                    }`}
                            >
                                ★ {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {loading && results.length === 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {[...Array(18)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-[2/3] rounded-xl bg-white/5" />
                                <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : results.length > 0 ? (
                    <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {results.map((item) => (
                                <Link
                                    key={`${item.tmdb_id}-${item.media_type}`}
                                    href={`/movie/${item.tmdb_id}?type=${item.media_type}`}
                                    className="group"
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-accent-gold/30 transition-all">
                                        <PosterImage
                                            src={item.poster_url}
                                            alt={item.title}
                                            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw"
                                        />

                                        {/* Rating */}
                                        {item.tmdb_vote_average && item.tmdb_vote_average > 0 && (
                                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[9px] font-bold text-accent-gold z-10">
                                                ★ {item.tmdb_vote_average.toFixed(1)}
                                            </div>
                                        )}

                                        {/* Verdict badge */}
                                        {item.verdict && (
                                            <div className="absolute bottom-2 left-2 z-10">
                                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${item.verdict === "WORTH IT"
                                                        ? "text-green-400 bg-green-400/10 border-green-400/30"
                                                        : item.verdict === "NOT WORTH IT"
                                                            ? "text-red-400 bg-red-400/10 border-red-400/30"
                                                            : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                                                    }`}>
                                                    {item.verdict}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="mt-2 text-xs font-medium text-white/70 truncate group-hover:text-white transition-colors">
                                        {item.title}
                                    </p>
                                    {item.release_date && (
                                        <p className="text-[10px] text-white/30">
                                            {item.release_date.split("-")[0]}
                                        </p>
                                    )}
                                </Link>
                            ))}
                        </div>

                        {/* Load More */}
                        {page < totalPages && (
                            <div className="mt-8 text-center">
                                <button
                                    onClick={() => fetchResults(page + 1)}
                                    disabled={loading}
                                    className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                                >
                                    {loading ? "Loading..." : "Load More"}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-16">
                        <p className="text-4xl mb-4">🔍</p>
                        <h3 className="text-xl font-bold text-white/60 mb-2">No results found</h3>
                        <p className="text-sm text-white/30">
                            Try adjusting your filters or clearing them.
                        </p>
                        <button
                            onClick={clearFilters}
                            className="mt-4 px-6 py-2 bg-accent-gold text-black rounded-full text-sm font-bold"
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}