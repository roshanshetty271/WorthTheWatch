"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";

interface ListItem {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    media_type: string;
    verdict: string | null;
}

interface ListData {
    id: string;
    name: string;
    description: string;
    is_public: boolean;
    isOwner: boolean;
}

const verdictColor = (v: string | null) => {
    switch (v) {
        case "WORTH IT":
            return "bg-accent-gold/10 text-accent-gold border-accent-gold/30";
        case "NOT WORTH IT":
            return "bg-red-500/10 text-red-400 border-red-500/30";
        case "MIXED BAG":
            return "bg-orange-400/10 text-orange-400 border-orange-400/30";
        default:
            return "bg-white/5 text-white/60 border-white/10";
    }
};

const getPosterUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${TMDB_IMAGE_BASE}${path}`;
};

export default function PublicListPage({ listId }: { listId: string }) {
    const [list, setList] = useState<ListData | null>(null);
    const [items, setItems] = useState<ListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`/api/lists/items?list_id=${listId}`)
            .then((res) => {
                if (!res.ok) throw new Error(res.status === 403 ? "This list is private" : "List not found");
                return res.json();
            })
            .then((data) => {
                setList(data.list);
                setItems(data.items || []);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [listId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !list) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
                <p className="text-4xl mb-4">🔒</p>
                <h1 className="font-display text-2xl text-white mb-2">{error || "List not found"}</h1>
                <p className="text-sm text-text-secondary mb-6">This list may not exist or it could be private.</p>
                <Link href="/" className="px-6 py-2.5 bg-accent-gold text-black font-bold rounded-xl text-sm hover:bg-accent-goldLight transition-colors">
                    Go Home
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-display font-black text-white">{list.name}</h1>
                    {list.description && (
                        <p className="text-text-secondary mt-2 max-w-lg">{list.description}</p>
                    )}
                    <p className="text-xs text-text-muted mt-2">
                        {items.length} {items.length === 1 ? "movie" : "movies"}
                    </p>
                </div>

                {items.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-text-muted text-sm">This list is empty.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {items.map((item) => {
                            const poster = getPosterUrl(item.poster_path);
                            return (
                                <Link
                                    key={item.tmdb_id}
                                    href={`/movie/${item.tmdb_id}?type=${item.media_type || "movie"}`}
                                    className="group relative"
                                >
                                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5">
                                        {poster ? (
                                            <Image
                                                src={poster}
                                                alt={item.title}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <span className="text-4xl">🎬</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-white text-sm font-medium truncate">{item.title}</p>
                                        {item.verdict && (
                                            <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictColor(item.verdict)}`}>
                                                {item.verdict}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
