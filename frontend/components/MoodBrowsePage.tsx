"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MovieCard from "@/components/MovieCard";
import type { MovieWithReview } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const MOOD_META: Record<string, {
    label: string;
    description: string;
    glow: string;
    textColor: string;
    pillActive: string;
}> = {
    tired: {
        label: "Tired",
        description: "Easy watches for when you want to unwind without thinking too hard.",
        glow: "from-blue-500/10 via-transparent to-transparent",
        textColor: "text-blue-400",
        pillActive: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    pumped: {
        label: "Pumped",
        description: "High-octane films that will keep your adrenaline going.",
        glow: "from-red-500/10 via-transparent to-transparent",
        textColor: "text-red-400",
        pillActive: "bg-red-500/10 text-red-400 border-red-500/30",
    },
    emotional: {
        label: "Emotional",
        description: "Films that hit you in the feels. Tissues recommended.",
        glow: "from-purple-500/10 via-transparent to-transparent",
        textColor: "text-purple-400",
        pillActive: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    cerebral: {
        label: "Cerebral",
        description: "Mind-bending stories that will keep you thinking for days.",
        glow: "from-teal-500/10 via-transparent to-transparent",
        textColor: "text-teal-400",
        pillActive: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    },
    fun: {
        label: "Fun",
        description: "Light, entertaining watches that will put a smile on your face.",
        glow: "from-amber-500/10 via-transparent to-transparent",
        textColor: "text-amber-400",
        pillActive: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
};

const ALL_MOODS = ["tired", "pumped", "emotional", "cerebral", "fun"];

interface MoodBrowsePageProps {
    mood: string;
}

export default function MoodBrowsePage({ mood }: MoodBrowsePageProps) {
    const router = useRouter();
    const [movies, setMovies] = useState<MovieWithReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const meta = MOOD_META[mood] || MOOD_META["fun"];

    const fetchMovies = useCallback(async () => {
        setLoading(true);
        setMovies([]);
        try {
            const res = await fetch(
                `${API_BASE}/api/movies?category=mood-${mood}&limit=6`
            );
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setMovies(data.movies || []);
        } catch (e) {
            console.error("Mood fetch failed:", e);
            setMovies([]);
        } finally {
            setLoading(false);
        }
    }, [mood]);

    useEffect(() => {
        fetchMovies();
    }, [fetchMovies, refreshKey]);

    useEffect(() => {
        setRefreshKey(0);
        setMovies([]);
        setLoading(true);
    }, [mood]);

    const handleShuffle = () => {
        setRefreshKey((k) => k + 1);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Mood color glow */}
            <div className={`absolute top-0 left-0 right-0 h-[300px] bg-gradient-to-b ${meta.glow} pointer-events-none`} />

            <div className="relative pt-28 pb-16 px-4 md:px-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-2">
                        <h1 className="text-3xl md:text-4xl font-display font-black text-white">
                            Feeling{" "}
                            <span className={meta.textColor}>{meta.label}</span>
                        </h1>

                        {!loading && movies.length > 0 && (
                            <button
                                onClick={handleShuffle}
                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider hover:text-accent-gold hover:border-accent-gold/30 transition-all"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Shuffle
                            </button>
                        )}
                    </div>

                    <p className="text-white/60 text-sm mb-8 max-w-lg">
                        {meta.description}
                    </p>

                    {/* Mood switcher pills */}
                    <div className="flex gap-2 mb-10 overflow-x-auto pb-2 scrollbar-hide">
                        {ALL_MOODS.map((key) => {
                            const m = MOOD_META[key];
                            return (
                                <button
                                    key={key}
                                    onClick={() => router.push(`/browse/mood/${key}`)}
                                    className={`
                    flex items-center px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider
                    transition-all flex-shrink-0 border
                    ${key === mood
                                            ? m.pillActive
                                            : "bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-white/20"
                                        }
                  `}
                                >
                                    {m.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Loading */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-8 h-8 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                            <p className="text-white/60 text-sm mt-4">Finding picks for you...</p>
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && movies.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <h2 className="text-xl font-bold text-white mb-2">
                                No picks for this mood yet
                            </h2>
                            <p className="text-white/60 text-sm max-w-[300px] mb-6">
                                We are still building our library. Try searching for movies to help us grow it.
                            </p>
                            <Link
                                href="/"
                                className="px-8 py-3 bg-accent-gold text-black font-bold uppercase tracking-wider rounded-xl text-xs hover:brightness-110 transition-all"
                            >
                                Search Movies
                            </Link>
                        </div>
                    )}

                    {/* Movie Grid — uses your existing MovieCard, same as homepage */}
                    {!loading && movies.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 md:gap-6">
                            {movies.map((movie) => (
                                <MovieCard key={movie.movie.tmdb_id} data={movie} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}