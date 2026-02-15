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

function MovieCard({ tmdb_id, title, poster_path, verdict, media_type }: {
    tmdb_id: number;
    title: string;
    poster_path?: string | null;
    verdict?: string | null;
    media_type?: string;
}) {
    const poster = getPosterUrl(poster_path ?? null);

    return (
        <Link href={`/movie/${tmdb_id}?type=${media_type || "movie"}`} className="group relative">
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
            </div>
            <div className="mt-2">
                <p className="text-white text-sm font-medium truncate">{title}</p>
                {verdict && (
                    <span className={`inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${verdictColor(verdict)}`}>
                        {verdict}
                    </span>
                )}
            </div>
        </Link>
    );
}

export default function MyListPage() {
    const searchParams = useSearchParams();
    const sharedIds = searchParams.get("ids");
    const isSharedView = !!sharedIds;

    const { items, count, getShareUrl, clear, isSignedIn } = useWatchlist();
    const [sharedMovies, setSharedMovies] = useState<SharedMovie[]>([]);
    const [loadingShared, setLoadingShared] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

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
                                <MovieCard key={m.tmdb_id} {...m} />
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

                {/* Movie Grid */}
                {count > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {items.map((item) => (
                            <MovieCard
                                key={item.tmdb_id}
                                tmdb_id={item.tmdb_id}
                                title={item.title}
                                poster_path={item.poster_path ?? null}
                                verdict={item.verdict ?? null}
                                media_type={item.media_type}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ═══════ Clear All Confirmation Dialog ═══════ */}
            {showClearConfirm && (
                <div
                    className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
                    onClick={() => setShowClearConfirm(false)}
                >
                    <div
                        className="w-full max-w-[340px] bg-[#141414] border border-white/10 rounded-2xl p-6 text-center shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg className="w-10 h-10 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <h3 className="text-lg font-bold text-white mb-1">Clear your watchlist?</h3>
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