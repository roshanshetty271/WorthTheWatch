"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
    hook?: string | null;
}

const GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime",
    "Documentary", "Drama", "Family", "Fantasy", "History",
    "Horror", "Music", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western",
];

const YEARS = Array.from({ length: 6 }, (_, i) => 2026 - i);

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
        <Image src={src} alt={alt} fill className="object-cover" sizes={sizes} unoptimized onError={() => setError(true)} />
    );
}

function VerdictPill({ verdict }: { verdict: string }) {
    const cls =
        verdict === "WORTH IT"
            ? "text-green-400 bg-green-400/10 border-green-400/30"
            : verdict === "NOT WORTH IT"
                ? "text-red-400 bg-red-400/10 border-red-400/30"
                : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
    return (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${cls}`}>
            {verdict}
        </span>
    );
}

function MoviePoster({ item, sizes }: { item: DiscoverResult; sizes: string }) {
    return (
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-accent-gold/30 transition-all">
            <PosterImage src={item.poster_url} alt={item.title} sizes={sizes} />
            {item.tmdb_vote_average && item.tmdb_vote_average > 0 && (
                <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-bold text-accent-gold z-10">
                    ★ {item.tmdb_vote_average.toFixed(1)}
                </div>
            )}
            {item.verdict && (
                <div className="absolute bottom-2 left-2 z-10"><VerdictPill verdict={item.verdict} /></div>
            )}
        </div>
    );
}

function loadSessionFilters() {
    if (typeof window === "undefined") return null;
    try {
        const saved = sessionStorage.getItem("discover_filters");
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
}

export default function DiscoverPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const saved = loadSessionFilters();

    const [mediaType, setMediaType] = useState<"movie" | "tv">(
        saved?.mediaType || (searchParams.get("type") as "movie" | "tv") || "movie"
    );
    const [genres, setGenres] = useState<string[]>(
        saved?.genres ?? (searchParams.get("genres")?.split(",").filter(Boolean) || [])
    );
    const [match, setMatch] = useState<"any" | "all">(
        saved?.match || (searchParams.get("match") as "any" | "all") || "any"
    );
    const [year, setYear] = useState<number | null>(
        saved?.year ?? (searchParams.get("year") ? parseInt(searchParams.get("year")!) : null)
    );
    const [minRating, setMinRating] = useState<number | null>(
        saved?.minRating ?? (searchParams.get("rating") ? parseFloat(searchParams.get("rating")!) : null)
    );
    const [sort, setSort] = useState(saved?.sort || searchParams.get("sort") || "popular");

    const [worthIt, setWorthIt] = useState<DiscoverResult[]>([]);
    const [results, setResults] = useState<DiscoverResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [fetchError, setFetchError] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const fetchResults = useCallback(async (pageNum: number = 1) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("media_type", mediaType);
            params.set("sort", sort);
            params.set("match", match);
            params.set("page", String(pageNum));
            params.set("min_votes", "200");
            if (genres.length) params.set("genre", genres.map((g) => g.toLowerCase()).join(","));
            if (year) params.set("year", String(year));
            if (minRating) params.set("min_rating", String(minRating));

            const res = await fetch(`${API_BASE}/api/discover?${params.toString()}`, { signal: controller.signal });
            if (res.ok) {
                const data = await res.json();
                setFetchError(false);
                if (pageNum === 1) {
                    setWorthIt(data.worth_it || []);
                    setResults(data.results || []);
                } else {
                    setResults((prev) => [...prev, ...(data.results || [])]);
                }
                setTotalPages(data.total_pages || 1);
                setPage(pageNum);
            }
        } catch (e) {
            if ((e as Error).name !== "AbortError") {
                setFetchError(true);
                if (pageNum === 1) { setWorthIt([]); setResults([]); }
            }
        } finally {
            setLoading(false);
        }
    }, [mediaType, genres, match, year, minRating, sort]);

    // Debounce filter changes (avoids hammering TMDB while toggling chips)
    useEffect(() => {
        const t = setTimeout(() => fetchResults(1), 300);
        return () => clearTimeout(t);
    }, [fetchResults]);

    // Persist to URL + sessionStorage (shareable links + back-button restore)
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("type", mediaType);
        if (genres.length) params.set("genres", genres.join(","));
        if (match !== "any") params.set("match", match);
        if (year) params.set("year", String(year));
        if (minRating) params.set("rating", String(minRating));
        if (sort !== "popular") params.set("sort", sort);
        router.replace(`/discover?${params.toString()}`, { scroll: false });
        try {
            sessionStorage.setItem("discover_filters", JSON.stringify({ mediaType, genres, match, year, minRating, sort }));
        } catch {}
    }, [mediaType, genres, match, year, minRating, sort, router]);

    const toggleGenre = (g: string) =>
        setGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

    const clearFilters = () => { setGenres([]); setMatch("any"); setYear(null); setMinRating(null); setSort("popular"); };

    const genreLabel = genres.length ? genres.join(" + ") : "Right Now";
    const hasFilters = genres.length > 0 || year || minRating || sort !== "popular" || match !== "any";

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="pt-28 md:pt-32 pb-2 px-4">
                <div className="max-w-6xl mx-auto">
                    <h1 className="font-display text-4xl md:text-5xl text-white tracking-tight">
                        Genre <span className="text-accent-gold">Picks</span>
                    </h1>
                    <p className="text-white/40 mt-2 text-sm max-w-md">
                        Pick your genres — we surface what&apos;s actually worth it first, then more to explore.
                    </p>
                </div>
            </div>

            {/* Sticky filter bar */}
            <div className="sticky top-16 z-30 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5 py-4 px-4">
                <div className="max-w-6xl mx-auto space-y-3">
                    {/* Row 1: Media · Match · Sort · Clear */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-white/5 rounded-full p-0.5">
                            {(["movie", "tv"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setMediaType(t)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${mediaType === t ? "bg-accent-gold text-black" : "text-white/50 hover:text-white/70"}`}
                                >
                                    {t === "movie" ? "Movies" : "TV Shows"}
                                </button>
                            ))}
                        </div>

                        {genres.length >= 2 && (
                            <div className="flex bg-white/5 rounded-full p-0.5 animate-fade-in">
                                {(["any", "all"] as const).map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setMatch(m)}
                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${match === m ? "bg-accent-gold text-black" : "text-white/50 hover:text-white/70"}`}
                                    >
                                        {m === "any" ? "Any of these" : "All of these"}
                                    </button>
                                ))}
                            </div>
                        )}

                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-white/70 focus:outline-none focus:border-accent-gold/50 appearance-none cursor-pointer"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value} className="bg-[#1a1a1a]">{opt.label}</option>
                            ))}
                        </select>

                        {hasFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-xs uppercase tracking-widest text-accent-gold/70 hover:text-accent-gold active:text-accent-gold py-1 px-2 -mr-2 transition-colors"
                            >
                                Clear All
                            </button>
                        )}
                    </div>

                    {/* Row 2: Genre chips (multi-select) */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                        {GENRES.map((g) => {
                            const active = genres.includes(g);
                            return (
                                <button
                                    key={g}
                                    onClick={() => toggleGenre(g)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none ${active ? "bg-accent-gold text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                                >
                                    {g}
                                </button>
                            );
                        })}
                    </div>

                    {/* Row 3: Year + Rating chips */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
                        {YEARS.map((y) => (
                            <button
                                key={y}
                                onClick={() => setYear(year === y ? null : y)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${year === y ? "bg-accent-gold text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                            >
                                {y}
                            </button>
                        ))}
                        <div className="w-px h-6 bg-white/10 self-center shrink-0 mx-1" />
                        {DECADES.map((d) => (
                            <button
                                key={d.value}
                                onClick={() => setYear(year === parseInt(d.value) ? null : parseInt(d.value))}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${year === parseInt(d.value) ? "bg-accent-gold text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                            >
                                {d.label}
                            </button>
                        ))}
                        <div className="w-px h-6 bg-white/10 self-center shrink-0 mx-1" />
                        {RATING_FILTERS.map((r) => (
                            <button
                                key={r.value}
                                onClick={() => setMinRating(minRating === r.value ? null : r.value)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${minRating === r.value ? "bg-accent-gold text-black" : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"}`}
                            >
                                ★ {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-6xl mx-auto px-4 py-8">
                {loading && worthIt.length === 0 && results.length === 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {[...Array(18)].map((_, i) => (
                            <div key={i} className="animate-pulse">
                                <div className="aspect-[2/3] rounded-xl bg-white/5" />
                                <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
                            </div>
                        ))}
                    </div>
                ) : fetchError && worthIt.length === 0 && results.length === 0 ? (
                    <div className="text-center py-16 animate-fade-in">
                        <p className="text-4xl mb-4">⚠️</p>
                        <h3 className="font-display text-xl text-white/60 mb-2">Couldn&apos;t load results</h3>
                        <p className="text-sm text-white/30">Check your connection and try again.</p>
                        <button onClick={() => fetchResults(1)} className="mt-4 px-6 py-2 bg-accent-gold text-black rounded-full text-sm font-bold">Retry</button>
                    </div>
                ) : (
                    <>
                        {/* ── Worth-It hero section ── */}
                        {worthIt.length > 0 && (
                            <section className="mb-12 animate-fade-in">
                                <div className="border-l-4 border-accent-gold pl-3 mb-5">
                                    <h2 className="font-body text-xl sm:text-2xl font-bold tracking-wide text-white uppercase">
                                        Worth It · {genreLabel}
                                    </h2>
                                    <p className="text-xs text-white/40 mt-1 normal-case tracking-normal">
                                        {genres.length ? "Vetted picks the internet backs" : "Critically loved right now"}
                                    </p>
                                </div>
                                {/* gap-y-8 keeps the hook lines from crowding the next row */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
                                    {worthIt.map((item) => (
                                        <Link
                                            key={`w-${item.tmdb_id}-${item.media_type}`}
                                            href={`/movie/${item.tmdb_id}?type=${item.media_type}`}
                                            className="group movie-card flex flex-col"
                                        >
                                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-accent-gold/30 group-hover:border-accent-gold/60 transition-all">
                                                <PosterImage src={item.poster_url} alt={item.title} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw" />
                                                {item.tmdb_vote_average && item.tmdb_vote_average > 0 && (
                                                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-bold text-accent-gold z-10">
                                                        ★ {item.tmdb_vote_average.toFixed(1)}
                                                    </div>
                                                )}
                                                {item.verdict && (
                                                    <div className="absolute bottom-2 left-2 z-10"><VerdictPill verdict={item.verdict} /></div>
                                                )}
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-white/85 truncate group-hover:text-white transition-colors">{item.title}</p>
                                            {item.hook ? (
                                                <p className="text-[11px] text-white/45 italic line-clamp-2 mt-0.5">&ldquo;{item.hook}&rdquo;</p>
                                            ) : item.release_date ? (
                                                <p className="text-[10px] text-white/30 mt-0.5">{item.release_date.split("-")[0]}</p>
                                            ) : null}
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ── More to explore (broad TMDB) ── */}
                        {results.length > 0 && (
                            <section>
                                {worthIt.length > 0 && (
                                    <div className="border-l-4 border-white/15 pl-3 mb-5">
                                        <h2 className="font-body text-lg sm:text-xl font-bold tracking-wide text-white/70 uppercase">
                                            More {genres.length ? genreLabel : ""} to Explore
                                        </h2>
                                    </div>
                                )}
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                                    {results.map((item) => (
                                        <Link
                                            key={`r-${item.tmdb_id}-${item.media_type}`}
                                            href={`/movie/${item.tmdb_id}?type=${item.media_type}`}
                                            className="group movie-card"
                                        >
                                            <MoviePoster item={item} sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 16vw" />
                                            <p className="mt-2 text-xs font-medium text-white/70 truncate group-hover:text-white transition-colors">{item.title}</p>
                                            {item.release_date && <p className="text-[10px] text-white/30">{item.release_date.split("-")[0]}</p>}
                                        </Link>
                                    ))}
                                </div>

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
                            </section>
                        )}

                        {/* Nothing at all */}
                        {worthIt.length === 0 && results.length === 0 && !loading && (
                            <div className="text-center py-16">
                                <p className="text-4xl mb-4">🔍</p>
                                <h3 className="text-xl font-bold text-white/60 mb-2">No results found</h3>
                                <p className="text-sm text-white/30">Try fewer genres, switch to &ldquo;Any of these&rdquo;, or clear filters.</p>
                                <button onClick={clearFilters} className="mt-4 px-6 py-2 bg-accent-gold text-black rounded-full text-sm font-bold">Clear Filters</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
