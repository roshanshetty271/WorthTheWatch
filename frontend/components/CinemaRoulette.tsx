import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const SESSION_KEY = "roulette_last_result";

const LOCAL_POSTERS = [
    "/images/movie1.webp", "/images/movie2.webp", "/images/movie3.webp", "/images/movie4.webp", "/images/movie5.webp",
    "/images/movie6.jpg", "/images/movie7.jpg", "/images/movie8.jpg", "/images/movie9.jpg", "/images/movie10.jpg",
    "/images/movie11.jpg", "/images/movie12.jpg", "/images/movie13.jpg", "/images/movie14.jpg", "/images/movie15.jpg",
    "/images/movie16.jpg", "/images/movie17.jpg", "/images/movie18.jpg", "/images/movie19.jpg", "/images/movie20.jpg",
    "/images/movie21.jpg", "/images/movie22.jpg", "/images/movie23.jpg", "/images/movie24.jpg", "/images/movie25.jpg",
    "/images/movie26.jpg", "/images/movie27.webp", "/images/movie28.avif", "/images/movie29.webp", "/images/movie30.avif",
];

const POSTER_W = 120;
const POSTER_H = 170;
const GAP = 8;
const WINNER_POS = 110;

interface RandomMovie {
    movie: {
        id: number;
        tmdb_id: number;
        title: string;
        poster_url: string | null;
        poster_path: string | null;
        release_date: string | null;
        tagline?: string;
    };
    review: {
        verdict: "WORTH IT" | "NOT WORTH IT" | "MIXED BAG";
        hook: string | null;
        review_text: string | null;
        imdb_score: number | null;
        vibe: string | null;
    } | null;
}

interface CinemaRouletteProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CinemaRoulette({ isOpen, onClose }: CinemaRouletteProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [phase, setPhase] = useState<"prompt" | "fadeout" | "spinning" | "expanding" | "reveal">("prompt");
    const [movie, setMovie] = useState<RandomMovie | null>(null);
    const [posterStrip, setPosterStrip] = useState<string[]>([]);
    const [spinKey, setSpinKey] = useState(0);
    const [winnerPoster, setWinnerPoster] = useState<string>("");
    const [navigating, setNavigating] = useState(false);
    const lastExcludeRef = useRef<number | null>(null);
    const initialPathRef = useRef(pathname);
    const abortRef = useRef<AbortController | null>(null);

    // On mount: check sessionStorage for a previous result
    useEffect(() => {
        if (!isOpen) return;
        try {
            const stored = sessionStorage.getItem(SESSION_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.movie && parsed.winnerPoster) {
                    setMovie(parsed.movie);
                    setWinnerPoster(parsed.winnerPoster);
                    lastExcludeRef.current = parsed.movie.movie.tmdb_id;
                    setPhase("reveal");
                    return;
                }
            }
        } catch { }
        setPhase("prompt");
    }, [isOpen]);

    // Save result to sessionStorage whenever we get one
    useEffect(() => {
        if (movie && winnerPoster && phase === "reveal") {
            try {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify({ movie, winnerPoster }));
            } catch { }
        }
    }, [movie, winnerPoster, phase]);

    // When route changes after clicking View Review, close modal smoothly
    useEffect(() => {
        if (navigating && pathname !== initialPathRef.current) {
            onClose();
            setTimeout(() => {
                setNavigating(false);
            }, 300);
        }
    }, [pathname, navigating, onClose]);

    useEffect(() => {
        if (isOpen) {
            initialPathRef.current = pathname;
        }
    }, [isOpen, pathname]);

    const formatPoster = (data: RandomMovie): string => {
        const raw = data.movie.poster_url;
        if (raw && raw.startsWith("http")) return raw;
        if (raw) return `${TMDB_IMAGE_BASE}${raw}`;
        if (data.movie.poster_path) return `${TMDB_IMAGE_BASE}${data.movie.poster_path}`;
        return "/images/movie1.webp";
    };

    const buildStrip = (winnerUrl: string): string[] => {
        const s1 = [...LOCAL_POSTERS].sort(() => Math.random() - 0.5);
        const s2 = [...LOCAL_POSTERS].sort(() => Math.random() - 0.5);
        const s3 = [...LOCAL_POSTERS].sort(() => Math.random() - 0.5);
        const s4 = [...LOCAL_POSTERS].sort(() => Math.random() - 0.5);
        const strip = [...s1, ...s2, ...s3, ...s4];
        strip[WINNER_POS] = winnerUrl;
        return strip;
    };

    const calcTargetX = (): number => {
        const winnerCenter = WINNER_POS * (POSTER_W + GAP) + POSTER_W / 2;
        const viewCenter = 190;
        return -(winnerCenter - viewCenter);
    };

    // The spin process:
    // 1. Fade out whatever is on screen (prompt or reveal) — 300ms
    // 2. While fading, fetch API + build strip
    // 3. When BOTH fade and fetch are done, show spinning phase
    // 4. Strip is already built, animation starts immediately
    // Result: no jerk, no static frame, no poster swap visible to user
    const startSpin = useCallback(async () => {
        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // Step 1: Fade out current content
        setPhase("fadeout");

        try {
            // Step 2: Fetch + build strip IN PARALLEL with the fade
            const excludeId = lastExcludeRef.current;
            const url = excludeId
                ? `${API_BASE}/api/movies/random?exclude=${excludeId}`
                : `${API_BASE}/api/movies/random`;

            const [data] = await Promise.all([
                fetch(url, { signal: controller.signal }).then((r) => {
                    if (!r.ok) throw new Error("Failed");
                    return r.json();
                }),
                // Minimum fade time — wait at least 350ms for the fade to complete
                new Promise((r) => setTimeout(r, 350)),
            ]);

            // If user closed modal during fetch, abort
            if (controller.signal.aborted) return;

            const poster = formatPoster(data as RandomMovie);
            setWinnerPoster(poster);
            setMovie(data as RandomMovie);
            lastExcludeRef.current = (data as RandomMovie).movie.tmdb_id;

            // Build strip with winner already placed
            const strip = buildStrip(poster);
            setPosterStrip(strip);
            setSpinKey((k) => k + 1);

            // Step 3: NOW show spinning. Strip is ready. No jerk.
            setPhase("spinning");
        } catch (e) {
            if (controller.signal.aborted) return;
            console.error("Roulette fetch failed:", e);
            setPhase("prompt");
        }
    }, []);

    const handleSpinComplete = useCallback(() => {
        setTimeout(() => setPhase("expanding"), 300);
    }, []);

    const handleExpandComplete = useCallback(() => {
        setPhase("reveal");
    }, []);

    const handleSpinAgain = useCallback(() => {
        startSpin();
    }, [startSpin]);

    const handleViewReview = useCallback(() => {
        if (!movie) return;
        setNavigating(true);
        router.push(`/movie/${movie.movie.tmdb_id}`);
    }, [movie, router]);

    // Close: abort any in-flight fetch, stop animations, close modal
    const handleClose = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        onClose();
        // Do NOT reset phase/movie — keep result for session persistence
        setNavigating(false);
    }, [onClose]);

    const verdictStyle = (v?: string) => {
        switch (v) {
            case "WORTH IT":
                return "text-accent-gold border-accent-gold bg-accent-gold/10";
            case "NOT WORTH IT":
                return "text-red-500 border-red-500 bg-red-500/10";
            case "MIXED BAG":
                return "text-orange-400 border-orange-400 bg-orange-400/10";
            default:
                return "text-accent-gold border-accent-gold bg-accent-gold/10";
        }
    };

    const getHookText = (): string => {
        if (movie?.review?.hook && movie.review.hook.length > 5) return movie.review.hook;
        if (movie?.review?.vibe && movie.review.vibe.length > 5) return movie.review.vibe;
        if (movie?.movie?.tagline && movie.movie.tagline.length > 5) return movie.movie.tagline;
        return "A film worth your time.";
    };

    if (!isOpen) return null;

    // Close button — reused across all phases
    const CloseButton = () => (
        <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-50 p-2 text-white/30 hover:text-white transition-colors"
        >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    );

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="roulette-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: navigating ? 0 : 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4 overflow-hidden"
                onClick={handleClose}
            >
                <motion.div
                    key="roulette-modal"
                    initial={{ scale: 0.92, opacity: 0 }}
                    animate={{ scale: navigating ? 0.95 : 1, opacity: navigating ? 0 : 1 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-[380px] bg-[#0d0d0d] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden"
                >

                    {/* ═══════ PHASE 0 — PROMPT ═══════ */}
                    {phase === "prompt" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="relative w-full min-h-[480px] flex flex-col items-center justify-center p-8 text-center overflow-hidden"
                        >
                            <div className="absolute inset-0 z-0">
                                <Image
                                    src="/images/movie-collage.jpg"
                                    alt="Movie Collage"
                                    fill
                                    className="object-cover opacity-20 grayscale scale-110"
                                    priority
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d0d] via-[#0d0d0d]/80 to-[#0d0d0d]/40" />
                            </div>

                            <CloseButton />

                            <div className="relative z-10 flex flex-col items-center gap-6">
                                <h2 className="text-[2.2rem] leading-[1.15] font-display text-white tracking-tight font-black">
                                    Can&apos;t decide<br />
                                    <span className="text-accent-gold">what to watch?</span>
                                </h2>
                                <button
                                    onClick={startSpin}
                                    className="mt-6 px-14 py-5 bg-accent-gold text-black font-black uppercase tracking-[0.25em] text-[10px] rounded-full hover:scale-105 active:scale-95 transition-all"
                                >
                                    Surprise Me
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* ═══════ FADEOUT — brief black screen between phases ═══════
              This plays while the API fetches + strip builds.
              Prevents the user from seeing the old content swap
              to new content. Just a clean fade to dark. */}
                    {phase === "fadeout" && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="w-full min-h-[480px] flex items-center justify-center bg-[#0d0d0d]"
                        >
                            <CloseButton />
                            <p className="text-accent-gold font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                                Finding your next watch...
                            </p>
                        </motion.div>
                    )}

                    {/* ═══════ PHASE 1 — SPINNING ═══════
              Strip is ALREADY BUILT before this phase mounts.
              No poster swap. No jerk. Fades in with strip
              already in motion (slow start from ease curve). */}
                    {phase === "spinning" && posterStrip.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="w-full min-h-[480px] flex flex-col items-center justify-center overflow-hidden"
                        >
                            <CloseButton />

                            <div className="relative overflow-hidden w-full h-[190px]">
                                <div className="absolute inset-y-0 left-0 w-20 z-20 bg-gradient-to-r from-[#0d0d0d] to-transparent pointer-events-none" />
                                <div className="absolute inset-y-0 right-0 w-20 z-20 bg-gradient-to-l from-[#0d0d0d] to-transparent pointer-events-none" />

                                <motion.div
                                    key={spinKey}
                                    className="flex flex-row items-center gap-2 will-change-transform"
                                    initial={{ x: 0 }}
                                    animate={{ x: calcTargetX() }}
                                    transition={{
                                        duration: 8,
                                        ease: [0.45, 0.05, 0.15, 1.0],
                                    }}
                                    onAnimationComplete={handleSpinComplete}
                                >
                                    {posterStrip.map((src, i) => (
                                        <div
                                            key={`${spinKey}-${i}`}
                                            className="flex-shrink-0 rounded-lg overflow-hidden bg-white/5"
                                            style={{ width: POSTER_W, height: POSTER_H }}
                                        >
                                            {src && (
                                                <Image
                                                    src={src}
                                                    alt=""
                                                    width={POSTER_W}
                                                    height={POSTER_H}
                                                    className="object-cover w-full h-full"
                                                    priority={i >= WINNER_POS - 3 && i <= WINNER_POS + 3}
                                                    unoptimized={src.startsWith("http")}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </motion.div>
                            </div>

                            <p className="mt-10 text-accent-gold font-black uppercase tracking-[0.3em] text-[10px] animate-pulse">
                                Finding your next watch...
                            </p>
                        </motion.div>
                    )}

                    {/* ═══════ PHASE 1.5 — EXPANDING ═══════ */}
                    {phase === "expanding" && movie && (
                        <div className="relative w-full min-h-[520px] flex items-center justify-center overflow-hidden bg-[#0d0d0d]">
                            <CloseButton />
                            <motion.div
                                className="absolute inset-0 overflow-hidden"
                                initial={{ scale: 0.32, borderRadius: 24, opacity: 0.9 }}
                                animate={{ scale: 1, borderRadius: 0, opacity: 1 }}
                                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                                onAnimationComplete={handleExpandComplete}
                            >
                                {winnerPoster && (
                                    <Image
                                        src={winnerPoster}
                                        alt={movie.movie.title}
                                        fill
                                        className="object-cover"
                                        priority
                                        unoptimized={winnerPoster.startsWith("http")}
                                    />
                                )}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.8, delay: 0.4 }}
                                    className="absolute inset-0 bg-gradient-to-t from-black from-10% via-black/70 via-40% to-black/15"
                                />
                            </motion.div>
                        </div>
                    )}

                    {/* ═══════ PHASE 2 — REVEAL ═══════ */}
                    {phase === "reveal" && movie && (
                        <div className="relative w-full min-h-[520px] flex flex-col">
                            <div className="absolute inset-0 z-0">
                                {winnerPoster && (
                                    <Image
                                        src={winnerPoster}
                                        alt={movie.movie.title}
                                        fill
                                        className="object-cover"
                                        priority
                                        unoptimized={winnerPoster.startsWith("http")}
                                    />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black from-15% via-black/75 via-45% to-black/20 z-10" />
                            </div>

                            <CloseButton />

                            <div className="relative z-20 mt-auto p-6 pb-8 flex flex-col items-center text-center gap-3">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.1 }}
                                    className={`px-5 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-sm ${verdictStyle(movie.review?.verdict)}`}
                                >
                                    {movie.review?.verdict || "WORTH IT"}
                                </motion.div>

                                <motion.p
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.25 }}
                                    className="text-[17px] font-serif italic text-accent-gold leading-snug max-w-[310px] drop-shadow-lg"
                                >
                                    &ldquo;{getHookText()}&rdquo;
                                </motion.p>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.4 }}
                                    className="flex flex-col items-center"
                                >
                                    <h3 className="text-xl font-bold text-white leading-tight">
                                        {movie.movie.title}
                                    </h3>
                                    <p className="text-white/50 text-xs mt-1 font-medium">
                                        {movie.movie.release_date?.split("-")[0] || ""}
                                        {movie.review?.imdb_score ? ` · IMDb ${movie.review.imdb_score}/10` : ""}
                                    </p>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.55 }}
                                    className="flex gap-3 w-full mt-3"
                                >
                                    <button
                                        onClick={handleViewReview}
                                        className="flex-1 py-3.5 bg-accent-gold text-black font-bold uppercase tracking-wider rounded-xl text-xs hover:brightness-110 active:scale-[0.98] transition-all"
                                    >
                                        View Review
                                    </button>
                                    <button
                                        onClick={handleSpinAgain}
                                        className="flex-1 py-3.5 bg-white/10 text-white font-bold uppercase tracking-wider rounded-xl text-xs hover:bg-white/20 active:scale-95 transition-all"
                                    >
                                        Spin Again
                                    </button>
                                </motion.div>
                            </div>
                        </div>
                    )}

                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}