"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface Activity {
    id: string;
    activity_type: string;
    tmdb_id: number;
    media_type: string;
    title: string;
    poster_path: string | null;
    created_at: string;
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    view: { label: "Viewed", icon: "👁", color: "text-blue-400" },
    generate: { label: "Generated verdict", icon: "⚡", color: "text-accent-gold" },
    battle: { label: "Movie battle", icon: "⚔️", color: "text-red-400" },
    roulette: { label: "Can't Decide spin", icon: "🎰", color: "text-purple-400" },
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

function deduplicateActivities(activities: Activity[]): Activity[] {
    const seen = new Map<string, Activity>();
    for (const a of activities) {
        const key = `${a.tmdb_id}-${new Date(a.created_at).toDateString()}`;
        const existing = seen.get(key);
        if (!existing) {
            seen.set(key, a);
        } else {
            const priority = ["generate", "battle", "roulette", "view"];
            const existingRank = priority.indexOf(existing.activity_type);
            const newRank = priority.indexOf(a.activity_type);
            if (newRank < existingRank) {
                seen.set(key, { ...a, poster_path: a.poster_path || existing.poster_path });
            } else if (!existing.poster_path && a.poster_path) {
                seen.set(key, { ...existing, poster_path: a.poster_path });
            }
        }
    }
    return Array.from(seen.values());
}

function groupByDate(activities: Activity[]): Record<string, Activity[]> {
    const groups: Record<string, Activity[]> = {};
    for (const a of activities) {
        const date = new Date(a.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let key: string;
        if (date.toDateString() === today.toDateString()) {
            key = "Today";
        } else if (date.toDateString() === yesterday.toDateString()) {
            key = "Yesterday";
        } else {
            key = date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        }

        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
    }
    return groups;
}

export default function HistoryPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const fetchHistory = useCallback(async (offset = 0) => {
        try {
            const res = await fetch(`/api/history?limit=50&offset=${offset}`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();

            if (offset === 0) {
                setActivities(data.activities || []);
            } else {
                setActivities((prev) => [...prev, ...(data.activities || [])]);
            }
            setTotal(data.total || 0);
            setHasMore(offset + 50 < (data.total || 0));
        } catch {
            if (offset === 0) setActivities([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user) {
            router.push("/");
            return;
        }
        fetchHistory();
    }, [session, status, router, fetchHistory]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user) return null;

    const grouped = groupByDate(deduplicateActivities(activities));

    return (
        <div className="min-h-screen pt-24 md:pt-28 pb-16">
            <div className="mx-auto max-w-3xl px-4">
                <div className="mb-8">
                    <h1 className="font-display text-2xl md:text-3xl text-white">Your History</h1>
                    <p className="mt-1 text-sm text-text-secondary">
                        {total > 0
                            ? `${total} activit${total === 1 ? "y" : "ies"} tracked`
                            : "Your activity will show up here as you explore."}
                    </p>
                </div>

                {activities.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-surface-card p-12 text-center">
                        <p className="text-4xl mb-4">📜</p>
                        <h2 className="font-display text-xl text-text-primary mb-2">No activity yet</h2>
                        <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
                            Search for movies, generate verdicts, run battles, or spin the roulette to build your history.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-gold text-black font-bold rounded-xl text-sm hover:bg-accent-goldLight transition-colors"
                        >
                            Start exploring
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(grouped).map(([dateLabel, items]) => (
                            <div key={dateLabel}>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3 border-b border-white/5 pb-2">
                                    {dateLabel}
                                </h3>
                                <div className="space-y-2">
                                    {items.map((a) => {
                                        const meta = ACTIVITY_LABELS[a.activity_type] || ACTIVITY_LABELS.view;
                                        const posterUrl = a.poster_path?.startsWith("http")
                                            ? a.poster_path
                                            : a.poster_path
                                                ? `https://image.tmdb.org/t/p/w92${a.poster_path}`
                                                : null;

                                        return (
                                            <Link
                                                key={a.id}
                                                href={`/movie/${a.tmdb_id}?type=${a.media_type || "movie"}`}
                                                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                                            >
                                                <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 relative">
                                                    {posterUrl && (
                                                        <Image
                                                            src={posterUrl}
                                                            alt=""
                                                            fill
                                                            className="object-cover"
                                                            unoptimized
                                                        />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white truncate group-hover:text-accent-gold transition-colors">
                                                        {a.title || `Movie #${a.tmdb_id}`}
                                                    </p>
                                                    <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1.5">
                                                        <span className={meta.color}>{meta.icon}</span>
                                                        <span>{meta.label}</span>
                                                        <span className="text-white/20">·</span>
                                                        <span>{formatDate(a.created_at)}</span>
                                                    </p>
                                                </div>
                                                <svg className="w-4 h-4 text-white/20 group-hover:text-accent-gold/60 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                </svg>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {hasMore && (
                            <div className="text-center pt-4">
                                <button
                                    onClick={() => fetchHistory(activities.length)}
                                    className="px-6 py-2.5 text-sm font-medium text-text-secondary border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    Load more
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
