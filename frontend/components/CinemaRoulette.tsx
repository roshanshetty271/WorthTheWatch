import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Types
interface RandomMovie {
    movie: {
        id: number;
        tmdb_id: number;
        title: string;
        poster_url: string | null;
        release_date: string | null;
        tmdb_vote_average: number;
    };
    review: {
        verdict: "WORTH IT" | "NOT WORTH IT" | "MIXED BAG";
        hook: string | null;
        tags: string[] | null;
        imdb_score: number | null;
    } | null;
}

interface CinemaRouletteProps {
    isOpen: boolean;
    onClose: () => void;
    blurPosters: string[]; // Decoy posters from homepage
}

export default function CinemaRoulette({ isOpen, onClose, blurPosters }: CinemaRouletteProps) {
    const router = useRouter();
    // Phases: prompt -> spinning -> reveal (or error)
    const [phase, setPhase] = useState<"prompt" | "spinning" | "reveal" | "error">("prompt");
    const [result, setResult] = useState<RandomMovie | null>(null);
    const [posterStrip, setPosterStrip] = useState<string[]>([]);
    const [excludeId, setExcludeId] = useState<number | null>(null);
    const [spinCount, setSpinCount] = useState(0);

    // Fetch random movie
    const fetchRandom = async (exclude?: number) => {
        try {
            const excludeParam = exclude ? `?exclude=${exclude}` : "";
            const res = await fetch(`${API_BASE}/api/movies/random${excludeParam}`);

            if (res.status === 404) {
                setPhase("error");
                return null;
            }

            if (!res.ok) throw new Error("Network response was not ok");
            return await res.json();
        } catch (e) {
            console.error("Roulette fetch error:", e);
            setPhase("error");
            return null;
        }
    };

    // Initialize Spin
    const startSpin = async () => {
        setPhase("spinning");
        setResult(null);
        setSpinCount(prev => prev + 1);

        // Generate a fresh set of 15-20 random posters for the strip
        // We use blurPosters as a base and shuffle/repeat them
        const basePosters = [...blurPosters, ...blurPosters, ...blurPosters, ...blurPosters, ...blurPosters];
        const shuffled = basePosters.sort(() => Math.random() - 0.5).slice(0, 15);
        setPosterStrip([...shuffled, "/placeholder.jpg"]); // Placeholder will be replaced by winner

        // Fetch IMMEDIATELY
        const winnerPromise = fetchRandom(excludeId || undefined);

        // Wait for animation (the trigger is onAnimationComplete, but we need the data ready)
        const winner = await winnerPromise;

        if (winner) {
            setResult(winner);
            setExcludeId(winner.movie.tmdb_id);
            // Replace the last item in the strip with the real winner's poster
            setPosterStrip(prev => [...prev.slice(0, -1), winner.movie.poster_url || "/placeholder.jpg"]);
        }
    };

    const handleSpinAgain = () => {
        startSpin();
    };

    const handleViewReview = () => {
        if (result) {
            onClose();
            router.push(`/movie/${result.movie.tmdb_id}`);
        }
    };

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(() => {
                setPhase("prompt");
                setResult(null);
                setExcludeId(null);
                setPosterStrip([]);
            }, 300);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const POSTER_WIDTH = 176; // w-44 = 11rem = 176px

    return (
        <AnimatePresence>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
            >
                {/* Modal Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-sm md:max-w-xl overflow-hidden rounded-2xl bg-[#121212] border border-white/10 shadow-2xl"
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-20 p-2 text-white/50 hover:text-white transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Content Container */}
                    <div className="flex flex-col items-center p-8 text-center min-h-[500px]">

                        {/* PHASE: ERROR */}
                        {phase === "error" && (
                            <div className="flex flex-col items-center justify-center h-full gap-4 mt-12">
                                <div className="text-4xl">🤔</div>
                                <h3 className="text-xl font-display text-white">Still building our library!</h3>
                                <p className="text-text-muted max-w-[250px]">
                                    We don't have enough reviews for the roulette yet. Check back soon!
                                </p>
                                <button
                                    onClick={onClose}
                                    className="mt-4 px-6 py-2 rounded-full bg-accent-gold text-black font-bold hover:bg-white transition-colors"
                                >
                                    Browse Movies
                                </button>
                            </div>
                        )}

                        {/* PHASE 0: PROMPT */}
                        {phase === "prompt" && (
                            <div className="relative w-full h-full flex flex-col items-center justify-center flex-grow overflow-hidden -mx-8 -my-8 p-12">
                                {/* Background Collage - 2x3 or 3x2 grid */}
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-2 p-2 select-none pointer-events-none">
                                    {[...blurPosters, ...blurPosters].slice(0, 6).map((src, i) => (
                                        <div key={i} className="relative w-full h-full overflow-hidden rounded-lg">
                                            <Image
                                                src={src}
                                                alt=""
                                                fill
                                                className="object-cover blur-[2px]"
                                                sizes="200px"
                                            />
                                        </div>
                                    ))}
                                    {/* Heavy Dark Overlay */}
                                    <div className="absolute inset-0 bg-black/80 z-[5]" />
                                </div>

                                {/* Content */}
                                <div className="relative z-10 flex flex-col items-center gap-6">
                                    <div className="text-6xl drop-shadow-2xl">🎬</div>
                                    <h2 className="text-3xl font-display text-white leading-tight max-w-[280px] drop-shadow-lg">
                                        Ready to discover your next watch?
                                    </h2>
                                    <button
                                        onClick={startSpin}
                                        className="mt-4 px-10 py-4 rounded-full bg-accent-gold text-black font-bold text-xl hover:scale-105 active:scale-95 transition-transform shadow-xl shadow-accent-gold/20"
                                    >
                                        Pick for me
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PHASE: SPINNING / RESULT */}
                        {(phase === "spinning" || phase === "reveal") && (
                            <div className="flex flex-col items-center w-full">
                                {/* 🎰 The Window (Horizontal) */}
                                <div className={`
                                    relative w-full h-[280px] rounded-xl overflow-hidden shadow-2xl bg-black border-2 border-white/10 mb-8 shrink-0
                                    ${phase === "spinning" ? "animate-pulse shadow-[0_0_30px_rgba(251,191,36,0.1)]" : "shadow-[0_0_50px_rgba(0,0,0,0.5)]"}
                                `}>
                                    <div className="h-full flex items-center">
                                        <motion.div
                                            key={spinCount}
                                            className="flex gap-4 px-4"
                                            animate={{ x: -(posterStrip.length - 1) * (POSTER_WIDTH + 16) }}
                                            transition={{
                                                duration: 5,
                                                ease: [0.12, 0.8, 0.3, 1.0],
                                            }}
                                            onAnimationComplete={() => {
                                                if (result) {
                                                    setPhase("reveal");
                                                }
                                            }}
                                        >
                                            {posterStrip.map((src, i) => (
                                                <div key={i} className="w-44 h-64 flex-shrink-0 relative rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                                    <Image
                                                        src={src}
                                                        alt="poster"
                                                        fill
                                                        className="object-cover"
                                                        sizes="200px"
                                                    />
                                                </div>
                                            ))}
                                        </motion.div>
                                    </div>

                                    {/* Vignette Overlay */}
                                    <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] z-10" />
                                </div>

                                {/* STATES */}
                                {phase === "spinning" && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ repeat: Infinity, duration: 1.5 }}
                                        className="text-accent-gold font-bold tracking-[0.2em] uppercase text-sm"
                                    >
                                        Choosing your next watch...
                                    </motion.p>
                                )}

                                {phase === "reveal" && result && (
                                    <motion.div
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            visible: { transition: { staggerChildren: 0.1 } }
                                        }}
                                        className="w-full flex flex-col items-center gap-4"
                                    >
                                        {/* 1. Verdict Badge */}
                                        <motion.div
                                            variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                                            className={`
                                                px-5 py-2 rounded-full text-[10px] font-black tracking-widest uppercase shadow-xl
                                                ${result.review?.verdict === "WORTH IT" ? "bg-accent-green text-black" :
                                                    result.review?.verdict === "MIXED BAG" ? "bg-accent-gold text-black" :
                                                        "bg-red-500 text-white"}
                                            `}
                                        >
                                            {result.review?.verdict === "WORTH IT" ? "✨ Worth It" :
                                                result.review?.verdict === "MIXED BAG" ? "🤔 Mixed Bag" : "🏃‍♂️ Skip It"}
                                        </motion.div>

                                        {/* 2. Title + Year + Score */}
                                        <motion.div variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}>
                                            <h2 className="text-3xl font-display text-white leading-tight">
                                                {result.movie.title}
                                            </h2>
                                            <p className="text-white/50 text-base mt-2 font-medium">
                                                {result.movie.release_date?.slice(0, 4)}
                                                {result.review?.imdb_score && ` • IMDb ${result.review.imdb_score}/10`}
                                            </p>
                                        </motion.div>

                                        {/* 3. Hook */}
                                        {result.review?.hook && (
                                            <motion.p
                                                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                                                className="text-white/90 italic font-serif text-xl leading-relaxed max-w-[90%]"
                                            >
                                                &ldquo;{result.review.hook}&rdquo;
                                            </motion.p>
                                        )}

                                        {/* 4. Tags */}
                                        {result.review?.tags && (
                                            <motion.div
                                                variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                                                className="flex flex-wrap justify-center gap-2 mt-2"
                                            >
                                                {result.review.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} className="text-[10px] uppercase font-bold tracking-widest text-white/50 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </motion.div>
                                        )}

                                        {/* 5. Buttons */}
                                        <motion.div
                                            variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0 } }}
                                            className="grid grid-cols-2 gap-4 w-full mt-6"
                                        >
                                            <button
                                                onClick={handleViewReview}
                                                className="px-6 py-4 rounded-xl bg-accent-gold text-black font-black uppercase tracking-wider hover:bg-white transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-accent-gold/20"
                                            >
                                                View Review
                                            </button>
                                            <button
                                                onClick={handleSpinAgain}
                                                className="px-6 py-4 rounded-xl border-2 border-white/10 text-white font-black uppercase tracking-wider hover:bg-white/5 transition-all flex items-center justify-center gap-3 group"
                                            >
                                                <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                Spin Again
                                            </button>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
