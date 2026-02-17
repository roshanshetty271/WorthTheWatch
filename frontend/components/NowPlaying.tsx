"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface NowPlayingItem {
    tmdb_id: number;
    title: string;
    media_type: string;
    release_date: string;
    poster_url: string | null;
    tmdb_vote_average: number | null;
}

type Tab = "theaters" | "streaming" | "upcoming";

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

export default function NowPlaying() {
    const [tab, setTab] = useState<Tab>("theaters");
    const [items, setItems] = useState<NowPlayingItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);
            try {
                const endpoint =
                    tab === "theaters"
                        ? "/api/nowplaying/theaters"
                        : tab === "streaming"
                            ? "/api/nowplaying/streaming"
                            : "/api/nowplaying/upcoming";

                const res = await fetch(`${API_BASE}${endpoint}`);
                if (res.ok) {
                    const data = await res.json();
                    setItems(data.results || []);
                }
            } catch {
                setItems([]);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [tab]);

    const tabs: { key: Tab; label: string; icon: string }[] = [
        { key: "theaters", label: "In Theaters", icon: "🎬" },
        { key: "streaming", label: "New on Streaming", icon: "📺" },
        { key: "upcoming", label: "Coming Soon", icon: "🗓️" },
    ];

    return (
        <section className="py-8" id="now-playing">
            {/* Header */}
            <div className="flex items-end justify-between mb-4 px-4 sm:px-0">
                <div className="border-l-4 border-accent-gold pl-3 sm:pl-4">
                    <h2 className="font-body text-xl sm:text-2xl font-bold tracking-wide text-white uppercase">
                        Now Playing
                    </h2>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 px-4 sm:px-0">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${tab === t.key
                                ? "bg-accent-gold text-black"
                                : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                            }`}
                    >
                        <span>{t.icon}</span>
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden">
                            {t.key === "theaters" ? "Theaters" : t.key === "streaming" ? "Streaming" : "Soon"}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex gap-4 sm:gap-6 overflow-hidden px-4 sm:px-0">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="shrink-0 w-[140px] sm:w-[170px] md:w-[200px] animate-pulse"
                        >
                            <div className="aspect-[2/3] rounded-xl bg-white/5" />
                            <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
                        </div>
                    ))}
                </div>
            ) : items.length > 0 ? (
                <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-pl-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                    {items.map((item) => (
                        <Link
                            key={item.tmdb_id}
                            href={`/movie/${item.tmdb_id}?type=${item.media_type}`}
                            className="snap-start shrink-0 w-[140px] sm:w-[170px] md:w-[200px] group"
                        >
                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 border border-white/10 group-hover:border-accent-gold/30 transition-all">
                                <PosterImage src={item.poster_url} alt={item.title} />

                                {/* Rating badge */}
                                {item.tmdb_vote_average && item.tmdb_vote_average > 0 && (
                                    <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-accent-gold z-10">
                                        ★ {item.tmdb_vote_average.toFixed(1)}
                                    </div>
                                )}

                                {/* Tab-specific badge */}
                                <div className="absolute top-2 left-2 z-10">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm ${tab === "theaters"
                                            ? "bg-red-500/20 text-red-300 border border-red-500/30"
                                            : tab === "streaming"
                                                ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                        }`}>
                                        {tab === "theaters" ? "IN THEATERS" : tab === "streaming" ? "NEW" : "SOON"}
                                    </span>
                                </div>
                            </div>

                            <p className="mt-2 text-xs font-medium text-white/70 truncate group-hover:text-white transition-colors">
                                {item.title}
                            </p>
                            {item.release_date && (
                                <p className="text-[10px] text-white/30">
                                    {new Date(item.release_date).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </p>
                            )}
                        </Link>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-white/30 text-center py-8">
                    No results found.
                </p>
            )}
        </section>
    );
}