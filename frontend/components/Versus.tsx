/**
 * Worth the Watch? — Versus
 * AI-powered 1v1 movie battles with witty comparisons.
 * 
 * Trending battles landing → custom battles → shareable results.
 * No sign-in required. Every battle generates unique, funny content.
 */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useWatchlist } from "@/lib/useWatchlist";
import dynamic from "next/dynamic";
const BattleShareCard = dynamic(() => import("@/components/BattleShareCard"), {
    ssr: false,
    loading: () => (
        <button disabled className="flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest bg-surface-elevated text-white/30 border border-white/10">
            Loading...
        </button>
    ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TMDB_IMG = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w1280";

// ─── Types ─────────────────────────────────────────────

interface VersusMovie {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string | null;
    media_type: string;
    tmdb_vote_average: number | null;
    verdict: string | null;
    imdb_score: number | null;
}

interface BattleResult {
    winner_id: number;
    loser_id: number;
    winner_title: string;
    loser_title: string;
    kill_reason: string;
    winner_reasons: string[];
    loser_reasons: string[];
    breakdown: string;
    winner_headline: string;
    loser_headline: string;
    movie_a: VersusMovie;
    movie_b: VersusMovie;
}

interface QuickResult {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    poster_url: string | null;
    release_date: string | null;
    media_type: string;
    tmdb_vote_average: number | null;
    has_review: boolean;
}

type Phase = "landing" | "pulsing" | "loading" | "result";

// ─── Trending Battles ──────────────────────────────────

const TRENDING_BATTLES = [
    {
        id: "barbenheimer",
        label: "The Barbenheimer Showdown",
        subtitle: "Pink vs. Plutonium",
        a: { tmdb_id: 346698, title: "Barbie", media_type: "movie", poster_path: "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg" },
        b: { tmdb_id: 872585, title: "Oppenheimer", media_type: "movie", poster_path: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
    },
    {
        id: "superhero-goat",
        label: "Superhero Supremacy",
        subtitle: "Knight vs. Spider",
        a: { tmdb_id: 155, title: "The Dark Knight", media_type: "movie", poster_path: "/qJ2tW6WMUDux911BTUgMe1St0x2.jpg" },
        b: { tmdb_id: 324857, title: "Spider-Man: Into the Spider-Verse", media_type: "movie", poster_path: "/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg" },
    },
    {
        id: "space-brain",
        label: "Nolan vs. Nolan",
        subtitle: "Dreams vs. Black Holes",
        a: { tmdb_id: 27205, title: "Inception", media_type: "movie", poster_path: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg" },
        b: { tmdb_id: 157336, title: "Interstellar", media_type: "movie", poster_path: "/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg" },
    },
    {
        id: "animated-kings",
        label: "Animation Throwdown",
        subtitle: "Ogre vs. Super Family",
        a: { tmdb_id: 808, title: "Shrek", media_type: "movie", poster_path: "/iB64vpL3dIObOtMZgX3RqdVdQDc.jpg" },
        b: { tmdb_id: 9806, title: "The Incredibles", media_type: "movie", poster_path: "/2LqaLgk1Z2GiOfMey7BysJMueM0.jpg" },
    },
];

// ─── Loading Messages ──────────────────────────────────

const LOADING_MESSAGES = [
    "Analyzing vibe...",
    "Checking explosion density...",
    "Measuring acting range...",
    "Consulting Reddit...",
    "Counting plot holes...",
    "Rating the soundtrack...",
    "Evaluating meme potential...",
    "Comparing body counts...",
    "Judging costume design...",
    "Weighing cultural impact...",
    "Scanning for plot armor...",
    "Assessing rewatch value...",
];

// ─── Helpers ───────────────────────────────────────────

function getPosterUrl(path: string | null): string {
    if (!path) return "/images/movie1.webp";
    if (path.startsWith("http")) return path;
    return `${TMDB_IMG}${path}`;
}

function getBackdropUrl(path: string | null): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${TMDB_BACKDROP}${path}`;
}

// ─── Component ─────────────────────────────────────────

export default function Versus() {
    const router = useRouter();
    const { data: session } = useSession();
    const { addItem, removeItem, isInWatchlist } = useWatchlist();
    const [phase, setPhase] = useState<Phase>("landing");

    // Movie selection
    const [slotA, setSlotA] = useState<VersusMovie | null>(null);
    const [slotB, setSlotB] = useState<VersusMovie | null>(null);
    const [activeSlot, setActiveSlot] = useState<"a" | "b" | null>(null);
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<QuickResult[]>([]);
    const [searching, setSearching] = useState(false);

    // Battle state
    const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
    const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
    const [trendingPosters, setTrendingPosters] = useState<Record<number, string>>({});




    const searchTimeout = useRef<NodeJS.Timeout | null>(null);
    const loadingInterval = useRef<NodeJS.Timeout | null>(null);

    // ─── Fetch trending posters on mount ───────────────
    useEffect(() => {
        async function fetchTrendingPosters() {
            const allIds = TRENDING_BATTLES.flatMap((b) => [b.a, b.b]);
            const uniqueEntries = allIds.filter((v, i, a) =>
                a.findIndex(x => x.tmdb_id === v.tmdb_id) === i
            );
            const posterMap: Record<number, string> = {};

            // Pre-fill with hardcoded fallbacks
            uniqueEntries.forEach((entry) => {
                if (entry.poster_path) {
                    posterMap[entry.tmdb_id] = `${TMDB_IMG}${entry.poster_path}`;
                }
            });

            // Try to fetch fresh posters (non-blocking)
            try {
                await Promise.all(
                    uniqueEntries.map(async (entry) => {
                        try {
                            const res = await fetch(`${API_BASE}/api/movies/${entry.tmdb_id}`);
                            if (res.ok) {
                                const data = await res.json();
                                const pp = data.movie?.poster_path;
                                if (pp) posterMap[entry.tmdb_id] = pp.startsWith("http") ? pp : `${TMDB_IMG}${pp}`;
                            }
                        } catch { }
                    })
                );
            } catch { }

            setTrendingPosters(posterMap);
        }
        fetchTrendingPosters();
    }, []);



    // ─── Search ────────────────────────────────────────

    const handleSearch = useCallback((value: string) => {
        setQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (value.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        searchTimeout.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/api/search/quick?q=${encodeURIComponent(value)}`
                );
                if (!res.ok) throw new Error("Search failed");
                const data = await res.json();
                setSearchResults(data.results || []);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);
    }, []);

    const selectMovie = useCallback(
        async (result: QuickResult) => {
            if (!activeSlot) return;

            // Fetch full data if available
            let verdict = null;
            let imdbScore = null;
            let backdropPath = null;
            try {
                const res = await fetch(`${API_BASE}/api/movies/${result.tmdb_id}?media_type=${result.media_type}`);
                if (res.ok) {
                    const data = await res.json();
                    backdropPath = data.movie?.backdrop_path || null;
                    if (data.review) {
                        verdict = data.review.verdict;
                        imdbScore = data.review.imdb_score;
                    }
                }
            } catch { }

            const movie: VersusMovie = {
                tmdb_id: result.tmdb_id,
                title: result.title,
                poster_path: result.poster_path,
                backdrop_path: backdropPath,
                release_date: result.release_date,
                media_type: result.media_type,
                tmdb_vote_average: result.tmdb_vote_average,
                verdict,
                imdb_score: imdbScore,
            };

            if (activeSlot === "a") setSlotA(movie);
            else setSlotB(movie);

            setActiveSlot(null);
            setQuery("");
            setSearchResults([]);
        },
        [activeSlot]
    );

    // ─── Start Battle ──────────────────────────────────
    // CRITICAL: movieAType and movieBType are required to prevent TMDB ID
    // collisions. TMDB ID 57911 can be both "Doraemon" (TV) and 
    // "Harry and the Butler" (movie). Without media_type, the backend
    // fetches the wrong title.

    const startBattle = useCallback(
        async (movieAId: number, movieBId: number, movieAType: string = "movie", movieBType: string = "movie") => {
            setPhase("loading");

            // Rotate loading messages
            let msgIdx = 0;
            loadingInterval.current = setInterval(() => {
                msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
                setLoadingMsg(LOADING_MESSAGES[msgIdx]);
            }, 1500);

            try {
                // Minimum loading time for suspense (3s)
                const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 3000));

                const [res] = await Promise.all([
                    fetch(
                        `${API_BASE}/api/versus/battle?movie_a_id=${movieAId}&movie_b_id=${movieBId}&movie_a_type=${movieAType}&movie_b_type=${movieBType}`,
                        { method: "POST" }
                    ),
                    minLoadingTime
                ]);

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.detail || "Battle failed");
                }

                const result: BattleResult = await res.json();
                setBattleResult(result);

                // Update slots with data from result (preserving correct media_type)
                setSlotA({
                    tmdb_id: result.movie_a.tmdb_id,
                    title: result.movie_a.title,
                    poster_path: result.movie_a.poster_path,
                    backdrop_path: result.movie_a.backdrop_path,
                    release_date: result.movie_a.release_date,
                    media_type: result.movie_a.media_type || movieAType,
                    tmdb_vote_average: result.movie_a.tmdb_vote_average,
                    verdict: result.movie_a.verdict,
                    imdb_score: result.movie_a.imdb_score,
                });
                setSlotB({
                    tmdb_id: result.movie_b.tmdb_id,
                    title: result.movie_b.title,
                    poster_path: result.movie_b.poster_path,
                    backdrop_path: result.movie_b.backdrop_path,
                    release_date: result.movie_b.release_date,
                    media_type: result.movie_b.media_type || movieBType,
                    tmdb_vote_average: result.movie_b.tmdb_vote_average,
                    verdict: result.movie_b.verdict,
                    imdb_score: result.movie_b.imdb_score,
                });

                setPhase("result");
            } catch (e: any) {
                console.error("Battle failed:", e);
                setPhase("landing");
                alert(e.message || "Battle failed. Try again.");
            } finally {
                if (loadingInterval.current) clearInterval(loadingInterval.current);
            }
        },
        []
    );

    const handleTrendingBattle = useCallback(
        (battle: (typeof TRENDING_BATTLES)[0]) => {
            setBattleResult(null);
            // Pre-populate slots so loading phase shows posters
            const posterA = battle.a.poster_path;
            const posterB = battle.b.poster_path;
            setSlotA({
                tmdb_id: battle.a.tmdb_id,
                title: battle.a.title,
                poster_path: posterA || null,
                backdrop_path: null,
                release_date: null,
                media_type: battle.a.media_type,
                tmdb_vote_average: null,
                verdict: null,
                imdb_score: null,
            });
            setSlotB({
                tmdb_id: battle.b.tmdb_id,
                title: battle.b.title,
                poster_path: posterB || null,
                backdrop_path: null,
                release_date: null,
                media_type: battle.b.media_type,
                tmdb_vote_average: null,
                verdict: null,
                imdb_score: null,
            });
            // Scroll to top, show pulsing phase, then start battle
            window.scrollTo({ top: 0, behavior: "smooth" });
            setPhase("pulsing");
            setTimeout(() => {
                startBattle(battle.a.tmdb_id, battle.b.tmdb_id, battle.a.media_type, battle.b.media_type);
            }, 2800);
        },
        [startBattle]
    );

    const handleCustomBattle = useCallback(() => {
        if (!slotA || !slotB) return;
        if (slotA.tmdb_id === slotB.tmdb_id && slotA.media_type === slotB.media_type) return;
        // Scroll to top, show pulsing phase, then start battle
        window.scrollTo({ top: 0, behavior: "smooth" });
        setPhase("pulsing");
        setTimeout(() => {
            startBattle(slotA.tmdb_id, slotB.tmdb_id, slotA.media_type, slotB.media_type);
        }, 2800);
    }, [slotA, slotB, startBattle]);

    // ─── Winner Actions ────────────────────────────────

    const winnerTmdbId = battleResult?.winner_id ?? 0;
    const winnerIsSaved = isInWatchlist(winnerTmdbId);

    const handleSaveWinner = useCallback(async () => {
        if (!battleResult) return;
        const winner = battleResult.winner_id === battleResult.movie_a.tmdb_id
            ? battleResult.movie_a
            : battleResult.movie_b;

        if (winnerIsSaved) {
            try {
                await removeItem(winner.tmdb_id);
            } catch { }
        } else {
            try {
                await addItem({
                    tmdb_id: winner.tmdb_id,
                    title: battleResult.winner_title,
                    poster_path: winner.poster_path,
                    media_type: winner.media_type || "movie",
                    verdict: winner.verdict,
                });
            } catch { }
        }
    }, [battleResult, winnerIsSaved, addItem, removeItem]);

    const handleViewReview = useCallback(() => {
        if (!battleResult) return;
        const winner = battleResult.winner_id === battleResult.movie_a.tmdb_id
            ? battleResult.movie_a
            : battleResult.movie_b;
        router.push(`/movie/${winner.tmdb_id}?type=${winner.media_type || "movie"}`);
    }, [battleResult, router]);



    const handleBattleAgain = useCallback(() => {
        setBattleResult(null);
        setPhase("landing");
    }, []);

    const handleRematch = useCallback(() => {
        if (!slotA || !slotB) return;
        startBattle(slotA.tmdb_id, slotB.tmdb_id, slotA.media_type, slotB.media_type);
    }, [slotA, slotB, startBattle]);

    const handleNewBattle = useCallback(() => {
        setBattleResult(null);
        setSlotA(null);
        setSlotB(null);
        setPhase("landing");
    }, []);

    // ─── Render ────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            {/* Header */}
            <div className="text-center pt-28 md:pt-32 pb-4">
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter">
                    <span className="text-white">Movie </span><span style={{ color: "#fbbf24" }}>Battle</span>
                </h1>
                <p className="text-white/40 mt-2 text-sm max-w-md mx-auto">
                    {phase === "landing" && "Two movies enter. One leaves victorious."}
                    {phase === "pulsing" && "Get ready..."}
                    {phase === "loading" && loadingMsg}
                    {phase === "result" && "The verdict is in."}
                </p>
            </div>

            {/* ═══════ LANDING PHASE ═══════ */}
            {phase === "landing" && (
                <div className="max-w-6xl mx-auto px-4 md:px-8 pb-16">

                    {/* ── Custom Battle Builder ── */}
                    <div className="mb-12">
                        <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-medium text-center mb-6">
                            Create Your Battle
                        </p>

                        <div className="flex items-center gap-4 md:gap-10 justify-center">
                            {/* Slot A */}
                            <MovieSlot
                                movie={slotA}
                                isActive={activeSlot === "a"}
                                onClick={() => {
                                    setActiveSlot(activeSlot === "a" ? null : "a");
                                    setQuery("");
                                    setSearchResults([]);
                                }}
                                onClear={() => setSlotA(null)}
                                label="A"
                            />

                            {/* VS Badge */}
                            <div className="flex-shrink-0">
                                <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-accent-gold/10 border-2 border-accent-gold/30 flex items-center justify-center">
                                    <span className="text-accent-gold font-black text-base md:text-xl">VS</span>
                                </div>
                            </div>

                            {/* Slot B */}
                            <MovieSlot
                                movie={slotB}
                                isActive={activeSlot === "b"}
                                onClick={() => {
                                    setActiveSlot(activeSlot === "b" ? null : "b");
                                    setQuery("");
                                    setSearchResults([]);
                                }}
                                onClear={() => setSlotB(null)}
                                label="B"
                            />
                        </div>

                        {/* Search bar — appears when a slot is active */}
                        <AnimatePresence>
                            {activeSlot && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="mt-4 overflow-hidden"
                                >
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            placeholder={`Search for Movie ${activeSlot.toUpperCase()}...`}
                                            className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-accent-gold/50 transition-colors text-sm"
                                            autoFocus
                                        />
                                        {searching && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
                                            </div>
                                        )}

                                        {/* Dropdown */}
                                        {searchResults.length > 0 && (
                                            <div className="mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-64 overflow-y-auto">
                                                {searchResults.slice(0, 6).map((r) => {
                                                    const isOtherSlot =
                                                        (activeSlot === "a" && slotB?.tmdb_id === r.tmdb_id) ||
                                                        (activeSlot === "b" && slotA?.tmdb_id === r.tmdb_id);
                                                    return (
                                                        <button
                                                            key={`${r.tmdb_id}-${r.media_type}`}
                                                            onClick={() => !isOtherSlot && selectMovie(r)}
                                                            disabled={isOtherSlot}
                                                            className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left ${isOtherSlot ? "opacity-30 cursor-not-allowed" : ""}`}
                                                        >
                                                            <div className="w-8 h-12 rounded overflow-hidden bg-white/5 flex-shrink-0 relative">
                                                                {r.poster_url && (
                                                                    <Image
                                                                        src={r.poster_url.startsWith("http") ? r.poster_url : getPosterUrl(r.poster_path)}
                                                                        alt=""
                                                                        width={32}
                                                                        height={48}
                                                                        className="object-cover w-full h-full"
                                                                        unoptimized
                                                                        onError={(e) => {
                                                                            const target = e.target as HTMLImageElement;
                                                                            target.style.display = "none";
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-medium text-white truncate">{r.title}</p>
                                                                <p className="text-[10px] text-white/40">
                                                                    {r.release_date?.split("-")[0] || ""} · {r.media_type === "tv" ? "TV" : "Movie"}
                                                                    {r.tmdb_vote_average ? ` · ★ ${r.tmdb_vote_average.toFixed(1)}` : ""}
                                                                </p>
                                                            </div>
                                                            {isOtherSlot && <span className="text-[10px] text-white/30">Other slot</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Battle button */}
                        <motion.button
                            onClick={handleCustomBattle}
                            disabled={!slotA || !slotB || (slotA.tmdb_id === slotB?.tmdb_id && slotA.media_type === slotB?.media_type)}
                            className={`w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all ${slotA && slotB && !(slotA.tmdb_id === slotB.tmdb_id && slotA.media_type === slotB.media_type)
                                ? "bg-accent-gold text-black hover:brightness-110 active:scale-[0.98] shadow-xl shadow-accent-gold/10"
                                : "bg-white/5 text-white/20 cursor-not-allowed"
                                }`}
                            whileTap={slotA && slotB ? { scale: 0.98 } : {}}
                        >
                            {!slotA && !slotB
                                ? "Pick two movies above"
                                : !slotA || !slotB
                                    ? "Pick one more movie"
                                    : "Simulate Battle"}
                        </motion.button>
                    </div>

                    {/* ── Trending Battles ── */}
                    <div>
                        <p className="text-xs text-white/30 uppercase tracking-[0.2em] font-medium text-center mb-6">
                            Trending Battles
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {TRENDING_BATTLES.map((battle) => (
                                <motion.button
                                    key={battle.id}
                                    onClick={() => handleTrendingBattle(battle)}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="relative overflow-hidden rounded-2xl border border-white/10 hover:border-accent-gold/30 transition-all group bg-surface-card p-4"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Poster A */}
                                        <div className="w-20 h-28 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 relative">
                                            {battle.a.poster_path && (
                                                <Image
                                                    src={trendingPosters[battle.a.tmdb_id] || `${TMDB_IMG}${battle.a.poster_path}`}
                                                    alt={battle.a.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = "none";
                                                    }}
                                                />
                                            )}
                                        </div>

                                        {/* VS + Labels */}
                                        <div className="flex-1 text-center">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <div className="flex items-center justify-center gap-2 w-full px-2">
                                                    <span className="text-sm font-bold text-white leading-tight">{battle.a.title}</span>
                                                    <span className="text-accent-gold font-black text-sm px-1">VS</span>
                                                    <span className="text-sm font-bold text-white leading-tight">{battle.b.title}</span>
                                                </div>
                                                <p className="text-[10px] text-accent-gold/60 mt-2 uppercase tracking-widest font-medium group-hover:text-accent-gold transition-colors">
                                                    {battle.subtitle}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Poster B */}
                                        <div className="w-20 h-28 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 relative">
                                            {battle.b.poster_path && (
                                                <Image
                                                    src={trendingPosters[battle.b.tmdb_id] || `${TMDB_IMG}${battle.b.poster_path}`}
                                                    alt={battle.b.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = "none";
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════ PULSING PHASE ═══════ */}
            {phase === "pulsing" && (
                <div className="max-w-3xl mx-auto px-4 md:px-8 pb-16">
                    <div className="flex items-center justify-center gap-6 md:gap-12">
                        {/* Poster A - pulsing */}
                        <motion.div
                            animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                            className="w-36 h-52 md:w-48 md:h-72 rounded-2xl overflow-hidden bg-white/5 relative border-2 border-accent-gold/40 shadow-2xl shadow-accent-gold/10"
                        >
                            {slotA?.poster_path && (
                                <Image
                                    src={slotA.poster_path.startsWith("http") ? slotA.poster_path : `${TMDB_IMG}${slotA.poster_path}`}
                                    alt={slotA.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = "none";
                                    }}
                                />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                <p className="text-xs font-bold text-white truncate">{slotA?.title}</p>
                            </div>
                        </motion.div>

                        {/* VS Badge - pulsing */}
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                            className="w-16 h-16 rounded-full bg-accent-gold/20 border-2 border-accent-gold flex items-center justify-center"
                        >
                            <span className="text-accent-gold font-black text-lg">VS</span>
                        </motion.div>

                        {/* Poster B - pulsing */}
                        <motion.div
                            animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                            className="w-36 h-52 md:w-48 md:h-72 rounded-2xl overflow-hidden bg-white/5 relative border-2 border-accent-gold/40 shadow-2xl shadow-accent-gold/10"
                        >
                            {slotB?.poster_path && (
                                <Image
                                    src={slotB.poster_path.startsWith("http") ? slotB.poster_path : `${TMDB_IMG}${slotB.poster_path}`}
                                    alt={slotB.title}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = "none";
                                    }}
                                />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                                <p className="text-xs font-bold text-white truncate">{slotB?.title}</p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}

            {/* ═══════ LOADING PHASE ═══════ */}
            {phase === "loading" && (
                <div className="max-w-3xl mx-auto px-4 md:px-8 pb-16">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center gap-8"
                    >
                        {/* Poster clash animation */}
                        <div className="flex items-center gap-0 relative">
                            <motion.div
                                initial={{ x: -100, rotate: -8 }}
                                animate={{ x: 0, rotate: -4 }}
                                transition={{ duration: 0.5, type: "spring" }}
                                className="w-40 h-60 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 relative z-10"
                            >
                                <Image
                                    src={getPosterUrl(slotA?.poster_path ?? null)}
                                    alt={slotA?.title || "Movie A"}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = "none";
                                    }}
                                />
                            </motion.div>

                            {/* Clash spark */}
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: [0, 1.5, 1] }}
                                transition={{ delay: 1.4, duration: 0.4 }}
                                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                            >
                                <div className="w-16 h-16 rounded-full bg-accent-gold/20 border-2 border-accent-gold flex items-center justify-center backdrop-blur-sm">
                                    <span className="text-accent-gold font-black text-lg">VS</span>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ x: 100, rotate: 8 }}
                                animate={{ x: 0, rotate: 4 }}
                                transition={{ duration: 0.5, type: "spring" }}
                                className="w-40 h-60 md:w-48 md:h-72 rounded-xl overflow-hidden shadow-2xl border-2 border-white/10 relative -ml-8"
                            >
                                <Image
                                    src={getPosterUrl(slotB?.poster_path ?? null)}
                                    alt={slotB?.title || "Movie B"}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = "none";
                                    }}
                                />
                            </motion.div>
                        </div>

                        {/* Loading message */}
                        <div className="text-center">
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={loadingMsg}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className="text-accent-gold text-sm font-medium"
                                >
                                    {loadingMsg}
                                </motion.p>
                            </AnimatePresence>
                            <div className="mt-4 w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto">
                                <motion.div
                                    className="h-full bg-accent-gold rounded-full"
                                    initial={{ width: "0%" }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: 12, ease: "linear" }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ═══════ RESULT PHASE ═══════ */}
            {phase === "result" && battleResult && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="max-w-3xl mx-auto px-4 md:px-8 pb-16"
                >
                    {/* Winner/Loser Cards */}
                    <div className="flex items-center gap-4 md:gap-6 justify-center mb-8" style={{ perspective: "800px" }}>
                        {/* Movie A */}
                        <ResultCard
                            movie={battleResult.movie_a}
                            isWinner={battleResult.winner_id === battleResult.movie_a.tmdb_id}
                            headline={
                                battleResult.winner_id === battleResult.movie_a.tmdb_id
                                    ? battleResult.winner_headline
                                    : battleResult.loser_headline
                            }
                        />

                        {/* VS */}
                        <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-accent-gold/10 border border-accent-gold/30 flex items-center justify-center">
                                <span className="text-accent-gold font-black text-xs">VS</span>
                            </div>
                        </div>

                        {/* Movie B */}
                        <ResultCard
                            movie={battleResult.movie_b}
                            isWinner={battleResult.winner_id === battleResult.movie_b.tmdb_id}
                            headline={
                                battleResult.winner_id === battleResult.movie_b.tmdb_id
                                    ? battleResult.winner_headline
                                    : battleResult.loser_headline
                            }
                        />
                    </div>

                    {/* Verdict Quote — the hero */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.3 }}
                        className="bg-surface-card border border-accent-gold/20 rounded-2xl p-6 md:p-8 mb-6 text-center"
                    >
                        <p className="text-[10px] text-accent-gold uppercase tracking-[0.3em] font-bold mb-3">
                            The Verdict
                        </p>
                        <p className="text-xl md:text-2xl font-display italic text-white leading-relaxed">
                            &ldquo;{battleResult.kill_reason}&rdquo;
                        </p>
                    </motion.div>

                    {/* Winner vs Loser Stats Grid */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.5 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
                    >
                        {/* Winner Stats */}
                        <div className="bg-verdict-worth/5 border border-verdict-worth/20 p-5 rounded-xl">
                            <h4 className="text-verdict-worth font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-verdict-worth/20 text-[10px]">✓</span>
                                Why {battleResult.winner_title} Won
                            </h4>
                            <ul className="space-y-2">
                                {(battleResult.winner_reasons?.length ? battleResult.winner_reasons : ['Superior execution', 'Stronger emotional impact', 'More rewatchable']).map((reason, i) => (
                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                        <span className="text-verdict-worth mt-0.5 text-xs">●</span>
                                        {reason}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Loser Stats */}
                        <div className="bg-red-500/5 border border-red-500/15 p-5 rounded-xl opacity-70">
                            <h4 className="text-red-400 font-bold text-sm uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px]">✗</span>
                                Why {battleResult.loser_title} Lost
                            </h4>
                            <ul className="space-y-2">
                                {(battleResult.loser_reasons?.length ? battleResult.loser_reasons : ['Close matchup', 'Strong but outclassed', 'Different strengths']).map((reason, i) => (
                                    <li key={i} className="text-sm text-white/50 flex items-start gap-2">
                                        <span className="text-red-400/60 mt-0.5 text-xs">●</span>
                                        {reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>

                    {/* Actions */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.7 }}
                        className="space-y-3"
                    >
                        {/* Primary: NEW BATTLE */}
                        <button
                            onClick={handleNewBattle}
                            className="w-full py-4 bg-accent-gold text-black font-black rounded-xl text-sm uppercase tracking-widest hover:bg-accent-goldLight active:scale-[0.98] transition-all shadow-lg shadow-accent-gold/10"
                        >
                            ⚔️ New Battle
                        </button>

                        {/* Secondary row: Save | Share | Rematch */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveWinner}
                                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${winnerIsSaved
                                    ? "bg-verdict-worth/10 text-verdict-worth border-verdict-worth/30 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                    : "bg-surface-elevated text-white/60 hover:text-white hover:bg-white/10 border-white/10"
                                    }`}
                            >
                                {winnerIsSaved ? "✗ Remove" : "💾 Save"}
                            </button>
                            <BattleShareCard
                                winnerTitle={battleResult.winner_title}
                                loserTitle={battleResult.loser_title}
                                winnerPosterPath={
                                    battleResult.winner_id === battleResult.movie_a.tmdb_id
                                        ? battleResult.movie_a.poster_path
                                        : battleResult.movie_b.poster_path
                                }
                                loserPosterPath={
                                    battleResult.winner_id === battleResult.movie_a.tmdb_id
                                        ? battleResult.movie_b.poster_path
                                        : battleResult.movie_a.poster_path
                                }
                                killReason={battleResult.kill_reason}
                                winnerHeadline={battleResult.winner_headline}
                                loserHeadline={battleResult.loser_headline}
                            />
                            <button
                                onClick={handleRematch}
                                className="flex-1 py-3 bg-surface-elevated text-accent-gold rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 border border-accent-gold/20 transition-all"
                            >
                                🔄 Rematch
                            </button>
                        </div>

                        {/* Tertiary: Read Full Review */}
                        <button
                            onClick={handleViewReview}
                            className="w-full py-2 text-white/30 text-xs font-medium uppercase tracking-widest hover:text-white/60 transition-colors"
                        >
                            Read {battleResult.winner_title}&apos;s Full Review →
                        </button>
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
}

// ─── Movie Slot (Search Slot) ──────────────────────────

function MovieSlot({
    movie,
    isActive,
    onClick,
    onClear,
    label,
}: {
    movie: VersusMovie | null;
    isActive: boolean;
    onClick: () => void;
    onClear: () => void;
    label: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 w-36 md:w-48">
            {movie ? (
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative group w-full"
                >
                    <div className="aspect-[2/3] rounded-xl overflow-hidden bg-white/5 relative border-2 border-white/10 group-hover:border-accent-gold/30 transition-colors">
                        <Image
                            src={getPosterUrl(movie.poster_path)}
                            alt={movie.title}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                        {movie.verdict && (
                            <div className="absolute top-2 left-2">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${movie.verdict === "WORTH IT"
                                    ? "text-green-400 bg-green-400/10 border-green-400/30"
                                    : movie.verdict === "NOT WORTH IT"
                                        ? "text-red-400 bg-red-400/10 border-red-400/30"
                                        : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                                    }`}>
                                    {movie.verdict}
                                </span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear(); }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                    >
                        <span className="text-white text-xs font-bold">×</span>
                    </button>
                    <p className="text-[10px] text-white/50 mt-1.5 truncate text-center">{movie.title}</p>
                </motion.div>
            ) : (
                <button
                    onClick={onClick}
                    className={`w-full aspect-[2/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${isActive
                        ? "border-accent-gold bg-accent-gold/5"
                        : "border-white/20 hover:border-white/40 bg-white/5"
                        }`}
                >
                    <span className={`text-3xl ${isActive ? "text-accent-gold" : "text-white/20"}`}>+</span>
                    <span className={`text-[10px] uppercase tracking-widest font-medium ${isActive ? "text-accent-gold" : "text-white/30"}`}>
                        Movie {label}
                    </span>
                </button>
            )}
        </div>
    );
}

// ─── Result Card ───────────────────────────────────────

function ResultCard({
    movie,
    isWinner,
    headline,
}: {
    movie: VersusMovie;
    isWinner: boolean;
    headline: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{
                opacity: 1,
                y: 0,
                scale: isWinner ? 1.05 : 0.88,
            }}
            transition={{ delay: isWinner ? 1.1 : 1.2, type: "spring", stiffness: 200 }}
            className={`flex flex-col items-center transition-all duration-500 ${isWinner
                ? "z-10 w-44 md:w-56"
                : "z-0 w-36 md:w-44 opacity-80"
                }`}
            style={{
                transformStyle: "preserve-3d",
                filter: isWinner ? "none" : "brightness(0.75)",
            }}
        >
            {/* Winner badge */}
            {isWinner && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 1.3, type: "spring" }}
                    className="mb-2"
                >
                    <div className="text-[9px] font-black text-black bg-accent-gold uppercase tracking-[0.2em] px-3 py-1 rounded-full">
                        Winner
                    </div>
                </motion.div>
            )}

            {/* Poster */}
            <div className={`w-full aspect-[2/3] rounded-xl overflow-hidden relative border-2 transition-all duration-500 ${isWinner
                ? "border-accent-gold shadow-xl shadow-accent-gold/30 ring-1 ring-accent-gold/20"
                : "border-white/10 grayscale-[60%]"
                }`}>
                <Image
                    src={getPosterUrl(movie.poster_path)}
                    alt={movie.title}
                    fill
                    className="object-cover"
                    unoptimized
                />
                {!isWinner && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-red-400/50 text-5xl font-bold">✕</span>
                    </div>
                )}
            </div>

            <p className={`text-xs mt-0.5 ${isWinner ? "text-accent-gold font-bold" : "text-white/40"}`}>
                {headline}
            </p>
            <p className={`mt-1 text-center w-full truncate ${isWinner ? "text-base md:text-lg font-black uppercase tracking-wider text-white" : "text-sm font-bold uppercase tracking-wide text-white/60"}`}>
                {movie.title}
            </p>
        </motion.div>
    );
}