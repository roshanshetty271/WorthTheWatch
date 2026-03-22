"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

interface ForYouMovie {
    movie: {
        tmdb_id: number;
        title: string;
        poster_url: string | null;
        media_type: string;
        release_date?: string;
    };
    review?: {
        verdict: string;
        vibe?: string;
        imdb_score?: number;
    } | null;
}

const VERDICT_COLORS: Record<string, string> = {
    "WORTH IT": "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
    "NOT WORTH IT": "text-rose-400 bg-rose-500/20 border-rose-500/30",
    "MIXED BAG": "text-amber-400 bg-amber-500/20 border-amber-500/30",
};

export default function ForYouSection() {
    const { data: session } = useSession();
    const [movies, setMovies] = useState<ForYouMovie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.user) {
            setLoading(false);
            return;
        }

        fetch("/api/recommendations")
            .then((res) => (res.ok ? res.json() : { movies: [] }))
            .then((data) => setMovies(data.movies || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [session]);

    if (!session?.user || loading || movies.length === 0) return null;

    return (
        <section className="py-8">
            <div className="flex items-end justify-between mb-6 px-4 sm:px-0">
                <div className="border-l-4 border-accent-gold pl-3 sm:pl-4">
                    <h2 className="font-body text-xl sm:text-2xl font-bold tracking-wide text-white uppercase">
                        For You
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">Based on your taste</p>
                </div>
                <Link
                    href="/profile"
                    className="group flex items-center gap-2 mb-1 py-1 px-1 -mr-1"
                >
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/50 group-hover:text-accent-gold transition-colors duration-200">
                        Your Profile
                    </span>
                    <div className="flex bg-white/5 p-1.5 rounded-full group-hover:bg-accent-gold/20 transition-colors duration-200">
                        <svg className="h-3 w-3 text-white/50 group-hover:text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                </Link>
            </div>

            <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-pl-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {movies.map((item) => (
                    <Link
                        key={item.movie.tmdb_id}
                        href={`/movie/${item.movie.tmdb_id}?type=${item.movie.media_type || "movie"}`}
                        className="snap-start shrink-0 w-[140px] sm:w-[170px] md:w-[200px] group"
                    >
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surface-card ring-1 ring-white/10 shadow-2xl transition-all duration-500 ease-out hover:-translate-y-2">
                            {item.movie.poster_url ? (
                                <Image
                                    src={item.movie.poster_url}
                                    alt={item.movie.title}
                                    fill
                                    sizes="(max-width: 640px) 140px, (max-width: 1024px) 170px, 200px"
                                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                    unoptimized
                                />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-surface-elevated">
                                    <span className="text-4xl text-text-muted">🎬</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />
                            {item.review?.verdict && (
                                <div className="absolute top-3 left-3 z-10">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md ${VERDICT_COLORS[item.review.verdict] || ""}`}>
                                        {item.review.verdict === "WORTH IT" ? "Worth It" : item.review.verdict === "NOT WORTH IT" ? "Skip" : "Mixed"}
                                    </span>
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
                                <h3 className="font-display text-sm sm:text-base font-bold leading-tight text-white line-clamp-2">
                                    {item.movie.title}
                                </h3>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
