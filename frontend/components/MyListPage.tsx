"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useWatchlist } from "@/lib/useWatchlist";
import BookmarkButton from "@/components/BookmarkButton";
import { signIn } from "next-auth/react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";


interface SharedMovie {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    verdict: string | null;
    media_type: string;
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

function WatchlistMovieCard({ tmdb_id, title, poster_path, verdict, media_type, status, onStatusChange }: {
    tmdb_id: number;
    title: string;
    poster_path?: string | null;
    verdict?: string | null;
    media_type?: string;
    status?: string;
    onStatusChange?: (tmdbId: number, status: "want_to_watch" | "watched" | "skipped") => void;
}) {
    const poster = getPosterUrl(poster_path ?? null);
    const [showStatusMenu, setShowStatusMenu] = useState(false);

    const statusBadge = status === "watched"
        ? { label: "Watched", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
        : status === "skipped"
            ? { label: "Skipped", color: "bg-red-500/20 text-red-400 border-red-500/30" }
            : null;

    return (
        <div className="group relative">
            <Link href={`/movie/${tmdb_id}?type=${media_type || "movie"}`}>
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5">
                    {poster ? (
                        <Image
                            src={poster}
                            alt={title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                        </div>
                    )}
                    <BookmarkButton
                        tmdb_id={tmdb_id}
                        title={title}
                        poster_path={poster_path ?? null}
                        verdict={verdict ?? null}
                        variant="card"
                    />
                    {statusBadge && (
                        <div className="absolute bottom-2 left-2 z-10">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm ${statusBadge.color}`}>
                                {statusBadge.label}
                            </span>
                        </div>
                    )}
                </div>
            </Link>
            <div className="mt-2 flex items-start justify-between gap-1">
                <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{title}</p>
                    {verdict && (
                        <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictColor(verdict)}`}>
                            {verdict}
                        </span>
                    )}
                </div>
                {onStatusChange && (
                    <div className="relative flex-shrink-0">
                        <button
                            onClick={() => setShowStatusMenu(!showStatusMenu)}
                            className="p-2 text-white/30 hover:text-white/70 active:text-white/70 transition-colors"
                            aria-label="Change status"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                            </svg>
                        </button>
                        {showStatusMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
                                <div className="absolute right-0 top-full mt-1 w-36 rounded-lg bg-surface-card border border-white/10 shadow-xl py-1 z-50">
                                    {[
                                        { value: "want_to_watch" as const, label: "Want to Watch" },
                                        { value: "watched" as const, label: "Watched" },
                                        { value: "skipped" as const, label: "Skipped" },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => {
                                                onStatusChange(tmdb_id, opt.value);
                                                setShowStatusMenu(false);
                                            }}
                                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${status === opt.value ? "text-accent-gold font-bold" : "text-text-secondary hover:text-white hover:bg-white/5"}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MyListPage() {
    const searchParams = useSearchParams();
    const sharedIds = searchParams.get("ids");
    const isSharedView = !!sharedIds;

    const { items, count, getShareUrl, clear, isSignedIn, updateStatus } = useWatchlist();
    const [sharedMovies, setSharedMovies] = useState<SharedMovie[]>([]);
    const [loadingShared, setLoadingShared] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>("all");
    const [customLists, setCustomLists] = useState<any[]>([]);
    const [showCreateList, setShowCreateList] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [newListDesc, setNewListDesc] = useState("");
    const [creatingList, setCreatingList] = useState(false);

    // Fetch custom lists for signed-in users
    useEffect(() => {
        if (!isSignedIn) return;
        fetch("/api/lists")
            .then((res) => (res.ok ? res.json() : { lists: [] }))
            .then((data) => setCustomLists(data.lists || []))
            .catch(() => {});
    }, [isSignedIn]);

    const handleCreateList = async () => {
        if (!newListName.trim() || creatingList) return;
        setCreatingList(true);
        try {
            const res = await fetch("/api/lists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newListName.trim(), description: newListDesc.trim(), is_public: true }),
            });
            if (res.ok) {
                const data = await res.json();
                setCustomLists((prev) => [{ ...data.list, item_count: 0 }, ...prev]);
                setNewListName("");
                setNewListDesc("");
                setShowCreateList(false);
            }
        } catch {}
        setCreatingList(false);
    };

    const handleDeleteList = async (listId: string) => {
        await fetch("/api/lists", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ list_id: listId }),
        }).catch(() => {});
        setCustomLists((prev) => prev.filter((l) => l.id !== listId));
    };

    // Fetch shared list movies
    useEffect(() => {
        if (!sharedIds) return;
        const ids = sharedIds.split(",").map(Number).filter(Boolean);
        if (ids.length === 0) return;

        setLoadingShared(true);
        Promise.all(
            ids.map(async (id) => {
                try {
                    const res = await fetch(`${API_BASE}/api/movies/${id}`);
                    if (!res.ok) return null;
                    const data = await res.json();
                    return {
                        tmdb_id: data.movie.tmdb_id,
                        title: data.movie.title,
                        poster_path: data.movie.poster_path,
                        verdict: data.review?.verdict || null,
                        media_type: data.movie.media_type || "movie",
                    } as SharedMovie;
                } catch {
                    return null;
                }
            })
        ).then((results) => {
            setSharedMovies(results.filter(Boolean) as SharedMovie[]);
            setLoadingShared(false);
        });
    }, [sharedIds]);

    const handleShare = useCallback(async () => {
        const url = getShareUrl();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const input = document.createElement("input");
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [getShareUrl]);

    const handleClearAll = useCallback(() => {
        clear();
        setShowClearConfirm(false);
    }, [clear]);

    // ─── Shared List View ───
    if (isSharedView) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-16 px-4 md:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-8">
                        <p className="text-white/60 text-sm uppercase tracking-widest mb-2">Shared Watchlist</p>
                        <h1 className="text-3xl font-display font-black text-white">
                            Someone shared their <span className="text-accent-gold">picks</span> with you
                        </h1>
                        {!loadingShared && (
                            <p className="text-white/60 text-sm mt-2">
                                {sharedMovies.length} {sharedMovies.length === 1 ? "movie" : "movies"}
                            </p>
                        )}
                    </div>

                    {loadingShared ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                        </div>
                    ) : sharedMovies.length === 0 ? (
                        <div className="flex flex-col items-center py-20 text-center">
                            <p className="text-white/40 text-sm mb-6">This shared list is empty or the movies could not be found.</p>
                            <Link href="/" className="px-8 py-3 bg-accent-gold text-black font-bold uppercase tracking-wider rounded-xl text-xs">
                                Browse Movies
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {sharedMovies.map((m) => (
                                <WatchlistMovieCard key={m.tmdb_id} {...m} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── Personal List View ───
    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-16 px-4 md:px-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-8">
                    <div>
                        <p className="text-white/60 text-sm uppercase tracking-widest mb-2">Your Watchlist</p>
                        <h1 className="text-3xl font-display font-black text-white">
                            My <span className="text-accent-gold">List</span>
                        </h1>
                        {count > 0 && (
                            <p className="text-white/60 text-sm mt-2">
                                {count} {count === 1 ? "movie" : "movies"} saved
                            </p>
                        )}
                    </div>

                    {count > 0 && (
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-2">
                                <button
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-accent-gold text-black text-xs font-bold uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-[0.98] transition-all"
                                >
                                    {copied ? (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                            </svg>
                                            Share List
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="px-3 py-2.5 bg-white/5 text-white/60 text-xs font-medium rounded-xl hover:text-red-400 hover:bg-red-500/10 transition-all"
                                >
                                    Clear All
                                </button>
                            </div>
                            {isSignedIn && (
                                <p className="text-[10px] text-text-muted mt-1 mr-1">
                                    Shared links work for everyone, no sign-in needed
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {!isSignedIn && items.length > 0 && (
                    <div className="mb-6 p-4 rounded-xl bg-accent-gold/5 border border-accent-gold/20 text-center">
                        <p className="text-sm text-text-secondary">
                            Your list is saved locally.
                            <button
                                onClick={() => signIn("google")}
                                className="text-accent-gold hover:text-accent-goldLight font-medium ml-1 underline underline-offset-2"
                            >
                                Sign in
                            </button>
                            {" "}to sync across devices.
                        </p>
                    </div>
                )}

                {/* Empty State */}
                {count === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <svg className="w-16 h-16 text-white/10 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <h2 className="text-xl font-bold text-white mb-2">Your list is empty</h2>
                        <p className="text-white/60 text-sm max-w-[280px] mb-8">
                            Save movies you want to watch and they will show up here.
                        </p>
                        <Link
                            href="/"
                            className="px-8 py-3 bg-accent-gold text-black font-bold uppercase tracking-wider rounded-xl text-xs hover:brightness-110 transition-all"
                        >
                            Browse Movies
                        </Link>
                    </div>
                )}

                {/* Filter Tabs */}
                {count > 0 && isSignedIn && (
                    <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                        {[
                            { value: "all", label: "All" },
                            { value: "want_to_watch", label: "Want to Watch" },
                            { value: "watched", label: "Watched" },
                            { value: "skipped", label: "Skipped" },
                        ].map((tab) => {
                            const tabCount = tab.value === "all"
                                ? items.length
                                : items.filter((i) => (i.status || "want_to_watch") === tab.value).length;
                            return (
                                <button
                                    key={tab.value}
                                    onClick={() => setActiveFilter(tab.value)}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${activeFilter === tab.value
                                        ? "bg-accent-gold text-black"
                                        : "bg-white/5 text-text-secondary hover:text-white hover:bg-white/10"
                                        }`}
                                >
                                    {tab.label}
                                    <span className={`text-[10px] ${activeFilter === tab.value ? "text-black/60" : "text-white/30"}`}>
                                        {tabCount}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Movie Grid */}
                {count > 0 && (() => {
                    const filtered = activeFilter === "all"
                        ? items
                        : items.filter((i) => (i.status || "want_to_watch") === activeFilter);

                    if (filtered.length === 0) {
                        return (
                            <div className="text-center py-16">
                                <p className="text-text-muted text-sm">No movies in this category yet.</p>
                            </div>
                        );
                    }

                    return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {filtered.map((item) => (
                                <WatchlistMovieCard
                                    key={item.tmdb_id}
                                    tmdb_id={item.tmdb_id}
                                    title={item.title}
                                    poster_path={item.poster_path ?? null}
                                    verdict={item.verdict ?? null}
                                    media_type={item.media_type}
                                    status={item.status}
                                    onStatusChange={isSignedIn ? (tmdbId, status) => updateStatus(tmdbId, status) : undefined}
                                />
                            ))}
                        </div>
                    );
                })()}
                {/* Custom Lists Section */}
                {isSignedIn && (
                    <div className="mt-12 pt-8 border-t border-white/5">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-white">Your Lists</h2>
                            <button
                                onClick={() => setShowCreateList(!showCreateList)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-text-secondary text-xs font-medium rounded-lg hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                New List
                            </button>
                        </div>

                        {showCreateList && (
                            <div className="mb-6 p-4 rounded-xl border border-white/10 bg-surface-card space-y-3">
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="List name (e.g. Date Night Picks)"
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-gold/50"
                                    maxLength={200}
                                />
                                <input
                                    type="text"
                                    value={newListDesc}
                                    onChange={(e) => setNewListDesc(e.target.value)}
                                    placeholder="Description (optional)"
                                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent-gold/50"
                                    maxLength={1000}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleCreateList}
                                        disabled={!newListName.trim() || creatingList}
                                        className="px-4 py-2 bg-accent-gold text-black text-xs font-bold rounded-lg hover:bg-accent-goldLight disabled:opacity-50 transition-colors"
                                    >
                                        {creatingList ? "Creating..." : "Create List"}
                                    </button>
                                    <button
                                        onClick={() => setShowCreateList(false)}
                                        className="px-4 py-2 text-text-secondary text-xs hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {customLists.length === 0 && !showCreateList ? (
                            <p className="text-text-muted text-sm text-center py-6">
                                Create custom lists to organize your movies.
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {customLists.map((list) => (
                                    <div
                                        key={list.id}
                                        className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 transition-colors group"
                                    >
                                        <Link href={`/list/${list.id}`} className="flex-1 min-w-0">
                                            <h3 className="text-sm font-medium text-white group-hover:text-accent-gold transition-colors truncate">
                                                {list.name}
                                            </h3>
                                            <p className="text-xs text-text-muted mt-0.5">
                                                {list.item_count || 0} {(list.item_count || 0) === 1 ? "movie" : "movies"}
                                                {list.is_public && " · Public"}
                                            </p>
                                        </Link>
                                        <button
                                            onClick={() => handleDeleteList(list.id)}
                                            className="p-2 text-white/20 hover:text-red-400 active:text-red-400 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                                            aria-label="Delete list"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════ Clear All Confirmation Dialog ═══════ */}
            {showClearConfirm && (
                <div
                    className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div
                        className="w-full max-w-[340px] bg-[#141414] border border-white/10 rounded-2xl p-6 text-center shadow-2xl animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg className="w-10 h-10 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <h3 className="font-display text-lg text-white mb-1">Clear your watchlist?</h3>
                        <p className="text-white/60 text-sm mb-6">
                            This will remove all {count} saved {count === 1 ? "movie" : "movies"}. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                className="flex-1 py-3 bg-white/5 text-white font-medium rounded-xl text-sm hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl text-sm hover:bg-red-600 active:scale-[0.98] transition-all"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {copied && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
                    <div className="bg-accent-gold text-black px-6 py-3 rounded-full text-sm font-bold shadow-lg animate-in fade-in slide-in-from-bottom-4">
                        Link copied to clipboard
                    </div>
                </div>
            )}
        </div>
    );
}