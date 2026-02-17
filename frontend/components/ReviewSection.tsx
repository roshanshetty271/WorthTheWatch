"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TriviaLoader from "./TriviaLoader";
import ReviewContent from "./ReviewContent";
import ErrorState from "./ErrorState";
import type { Review } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ReviewSectionProps {
    tmdbId: number;
    mediaType: string;
    movieTitle: string;
    initialReview: Review | null;
    onReviewUpdate?: (review: Review) => void;
    releaseDate?: string | null;
}

export default function ReviewSection({
    tmdbId,
    mediaType,
    movieTitle,
    initialReview,
    onReviewUpdate,
    releaseDate,
}: ReviewSectionProps) {
    const router = useRouter();
    const [review, setReview] = useState<Review | null>(initialReview);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState("Preparing...");
    const [percent, setPercent] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Check if movie is unreleased
    const isUnreleased = releaseDate ? new Date(releaseDate) > new Date() : false;

    // Poll for generation status
    useEffect(() => {
        if (!generating) return;

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/search/status/${tmdbId}`);
                if (res.ok) {
                    const data = await res.json();

                    if (data.status === "completed" && data.movie?.review) {
                        setReview(data.movie.review);
                        setGenerating(false);
                        onReviewUpdate?.(data.movie.review);
                        // Bust the server cache so navigating back shows the review
                        fetch(`/api/revalidate?path=/movie/${tmdbId}`, { method: "POST" }).catch(() => { });
                        // Refresh server components on this page
                        router.refresh();
                    } else if (data.status === "generating") {
                        setProgress(data.progress || "Analyzing...");
                        setPercent(data.percent || 10);
                    } else if (data.status === "not_found") {
                        // Still waiting for it to start
                        setProgress("Starting generation...");
                        setPercent(5);
                    }
                }
            } catch (e) {
                console.error("Status poll failed:", e);
            }
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [generating, tmdbId]);

    async function handleGenerate() {
        // Block unreleased movies
        if (isUnreleased) return;

        setGenerating(true);
        setError(null);
        setProgress("Starting...");

        try {
            const res = await fetch(
                `${API_BASE}/api/search/generate/${tmdbId}?media_type=${mediaType}`,
                { method: "POST" }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 429) {
                    setError("Rate limit reached. Please wait a moment before trying again.");
                    setGenerating(false);
                    return;
                }
                throw new Error(data.detail || "Failed to start generation");
            }

            const data = await res.json();
            if (data.status === "already_exists") {
                window.location.reload();
            } else if (data.status === "unreleased") {
                // Backend blocked it — movie not released yet
                setGenerating(false);
                setError(data.message || "This title hasn't been released yet.");
                return;
            }
            // Otherwise, polling will handle the rest
        } catch (e) {
            console.error("Generation failed:", e);
            setError(e instanceof Error ? e.message : "Failed to generate review");
            setGenerating(false);
        }
    }

    // STATE 1: Has review
    if (review) {
        return <ReviewContent review={review} releaseDate={releaseDate} />;
    }

    if (generating) {
        // Map backend progress to percentage
        const getProgressPercent = () => {
            const p = progress.toLowerCase();
            if (p.includes("start")) return 10;
            if (p.includes("search")) return 25;
            if (p.includes("read") || p.includes("gather")) return 50;
            if (p.includes("filter") || p.includes("analy")) return 70;
            if (p.includes("generat") || p.includes("writ")) return 85;
            if (p.includes("sav")) return 95;
            return 15;
        };

        const getProgressLabel = () => {
            const p = progress.toLowerCase();
            if (p.includes("start")) return "Starting search engines...";
            if (p.includes("search")) return "Scouring the internet for opinions...";
            if (p.includes("read") || p.includes("gather")) return "Reading critic reviews & Reddit...";
            if (p.includes("filter") || p.includes("analy")) return "Filtering the noise...";
            if (p.includes("generat") || p.includes("writ")) return "Writing your verdict...";
            if (p.includes("sav")) return "Almost done...";
            return "Warming up the AI...";
        };

        const pct = getProgressPercent();

        return (
            <div className="rounded-2xl border border-accent-gold/20 bg-accent-gold/5 p-8 text-center">
                {/* Fun fact while you wait */}
                <div className="mb-6">
                    <TriviaLoader />
                </div>

                {/* Progress bar */}
                <div className="max-w-xs mx-auto mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-accent-gold font-medium">
                            {getProgressLabel()}
                        </span>
                        <span className="text-xs text-accent-gold/60 font-bold">
                            {pct}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent-gold rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-8 text-center">
            {error && (
                <div className="mb-6">
                    <ErrorState
                        title="Generation Failed"
                        message={error}
                        icon="⚠️"
                        action={{ label: "Try Again", onClick: handleGenerate }}
                    />
                </div>
            )}

            {!error && (
                <>
                    {isUnreleased ? (
                        /* ─── Unreleased Movie ─── */
                        <>
                            <p className="text-4xl mb-4">🗓️</p>
                            <h3 className="font-display text-xl text-text-primary mb-2">
                                Coming Soon
                            </h3>
                            <p className="text-text-secondary mb-2 max-w-md mx-auto">
                                {movieTitle} hasn&apos;t been released yet. Check back after{" "}
                                {new Date(releaseDate!).toLocaleDateString("en-US", {
                                    month: "long",
                                    day: "numeric",
                                    year: "numeric",
                                })}{" "}
                                for the internet&apos;s verdict.
                            </p>
                        </>
                    ) : (
                        /* ─── Released Movie, No Review Yet ─── */
                        <>
                            <p className="text-4xl mb-4">🎬</p>
                            <h3 className="font-display text-xl text-text-primary mb-2">
                                No verdict yet for {movieTitle}
                            </h3>
                            <p className="text-text-secondary mb-6 max-w-md mx-auto">
                                Want to know what the internet thinks? We&apos;ll analyze reviews from
                                Reddit, critics, and forums in about 15 seconds.
                            </p>

                            <button
                                onClick={handleGenerate}
                                className="px-6 py-3 bg-accent-gold text-surface font-semibold rounded-xl hover:bg-accent-goldLight transition-colors active:scale-95"
                            >
                                Generate AI Review
                            </button>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
