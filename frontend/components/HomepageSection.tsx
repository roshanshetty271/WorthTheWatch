"use client";

import { useEffect, useState } from "react";
import MovieCard from "./MovieCard";
import type { MovieWithReview } from "@/lib/api";

interface Props {
    title: string;
    emoji: string;
    movies: MovieWithReview[];
    emptyMessage?: string;
}

export default function HomepageSection({ title, emoji, movies, emptyMessage }: Props) {
    if (movies.length === 0) {
        if (!emptyMessage) return null;
        return (
            <section className="py-8">
                <h2 className="mb-6 font-display text-xl text-text-primary flex items-center gap-2">
                    <span>{emoji}</span> {title}
                </h2>
                <p className="text-text-muted text-sm">{emptyMessage}</p>
            </section>
        );
    }

    return (
        <section className="py-8">
            <h2 className="mb-6 font-display text-xl text-text-primary flex items-center gap-2">
                <span>{emoji}</span> {title}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {movies.slice(0, 5).map((item) => (
                    <MovieCard key={item.movie.tmdb_id} data={item} />
                ))}
            </div>
        </section>
    );
}

// Client component that fetches curated sections
export function CuratedSections() {
    const [sections, setSections] = useState<{
        this_week: MovieWithReview[];
        hidden_gems: MovieWithReview[];
        skip_these: MovieWithReview[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSections = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_BASE}/api/movies/sections/curated`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                setSections(data);
            } catch {
                console.error("Failed to fetch curated sections");
            } finally {
                setLoading(false);
            }
        };

        fetchSections();
    }, []);

    if (loading) {
        return (
            <div className="space-y-12 py-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-6 w-48 rounded bg-surface-elevated mb-6"></div>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                            {[1, 2, 3, 4, 5].map((j) => (
                                <div key={j} className="aspect-[2/3] rounded-xl bg-surface-elevated"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (!sections) return null;

    const hasAnySection =
        sections.this_week.length > 0 ||
        sections.hidden_gems.length > 0 ||
        sections.skip_these.length > 0;

    if (!hasAnySection) return null;

    return (
        <div className="space-y-4">
            {sections.this_week.length > 0 && (
                <HomepageSection
                    title="This Week's Verdicts"
                    emoji="🎬"
                    movies={sections.this_week}
                />
            )}

            {sections.hidden_gems.length > 0 && (
                <HomepageSection
                    title="Hidden Gems"
                    emoji="💎"
                    movies={sections.hidden_gems}
                />
            )}

            {sections.skip_these.length > 0 && (
                <HomepageSection
                    title="Skip These"
                    emoji="🗑️"
                    movies={sections.skip_these}
                />
            )}
        </div>
    );
}
