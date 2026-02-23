"use client";

import { useState, useEffect, useRef } from "react";
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
    const [regenerating, setRegenerating] = useState(false);
    const eventSourceRef = useRef<EventSource | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const isUnreleased = releaseDate ? new Date(releaseDate) > new Date() : false;

    // ─── SSE Streaming ─────────────────────────────────────
    function startSSEStream() {
        if (eventSourceRef.current) eventSourceRef.current.close();

        const url = `${API_BASE}/api/search/stream/${tmdbId}`;
        console.log("[SSE] Connecting to:", url);
        const es = new EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => {
            console.log("[SSE] Connection opened");
        };

        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log("[SSE] Event:", data.type, data.message || "");
                if (data.type === "progress") {
                    setProgress(data.message || "Processing...");
                    setPercent(data.percent || 10);
                } else if (data.type === "completed") {
                    setReview(data.review);
                    setGenerating(false);
                    setRegenerating(false);
                    onReviewUpdate?.(data.review);
                    fetch(`/api/revalidate?path=/movie/${tmdbId}`, { method: "POST" }).catch(() => { });
                    router.refresh();
                    es.close();
                } else if (data.type === "error") {
                    setError(data.message || "Generation failed");
                    setGenerating(false);
                    setRegenerating(false);
                    es.close();
                }
            } catch (e) {
                console.warn("[SSE] Parse error:", e);
            }
        };

        es.onerror = (e) => {
            console.warn("[SSE] Connection error, falling back to polling", e);
            es.close();
            eventSourceRef.current = null;
            startPolling();
        };
    }

    // ─── Polling Fallback ──────────────────────────────────
    function startPolling() {
        if (pollRef.current) clearInterval(pollRef.current);

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/search/status/${tmdbId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === "completed" && data.movie?.review) {
                        setReview(data.movie.review);
                        setGenerating(false);
                        setRegenerating(false);
                        onReviewUpdate?.(data.movie.review);
                        fetch(`/api/revalidate?path=/movie/${tmdbId}`, { method: "POST" }).catch(() => { });
                        router.refresh();
                        if (pollRef.current) clearInterval(pollRef.current);
                    } else if (data.status === "generating") {
                        setProgress(data.progress || "Analyzing...");
                        setPercent(data.percent || 10);
                    } else if (data.status === "not_found") {
                        setProgress("Starting generation...");
                        setPercent(5);
                    }
                }
            } catch (e) {
                console.error("Status poll failed:", e);
            }
        }, 2000);
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (eventSourceRef.current) eventSourceRef.current.close();
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    // ─── Generate (first time) ─────────────────────────────
    async function handleGenerate() {
        if (isUnreleased) return;

        setGenerating(true);
        setError(null);
        setProgress("Starting...");
        setPercent(5);

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
                return;
            } else if (data.status === "unreleased") {
                setGenerating(false);
                setError(data.message || "This title hasn't been released yet.");
                return;
            }

            // Try SSE, fall back to polling
            try {
                startSSEStream();
            } catch {
                startPolling();
            }
        } catch (e) {
            console.error("Generation failed:", e);
            setError(e instanceof Error ? e.message : "Failed to generate review");
            setGenerating(false);
        }
    }

    // ─── Regenerate (refresh existing review) ──────────────
    async function handleRegenerate() {
        if (isUnreleased) return;

        setRegenerating(true);
        setGenerating(true);
        setReview(null);
        setError(null);
        setProgress("Refreshing verdict with latest data...");
        setPercent(5);

        try {
            const res = await fetch(
                `${API_BASE}/api/search/regenerate/${tmdbId}?media_type=${mediaType}`,
                { method: "POST" }
            );

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                if (res.status === 429) {
                    setError("Rate limit reached. Please wait a moment before trying again.");
                    setGenerating(false);
                    setRegenerating(false);
                    return;
                }
                throw new Error(data.detail || "Failed to regenerate");
            }

            try {
                startSSEStream();
            } catch {
                startPolling();
            }
        } catch (e) {
            console.error("Regeneration failed:", e);
            setError(e instanceof Error ? e.message : "Failed to regenerate review");
            setGenerating(false);
            setRegenerating(false);
        }
    }

    // ─── STATE 1: Has review ───────────────────────────────
    if (review) {
        return (
            <div className="relative">
                {/* Refresh Verdict — top right */}
                <div className="flex justify-end mb-3">
                    <button
                        onClick={handleRegenerate}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-accent-gold hover:bg-accent-gold/10 uppercase tracking-widest transition-all duration-200 group"
                    >
                        <svg
                            className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Verdict
                    </button>
                </div>

                <ReviewContent review={review} releaseDate={releaseDate} />
            </div>
        );
    }

    // ─── STATE 2: Generating ───────────────────────────────
    if (generating) {
        const getProgressPercent = () => {
            const p = progress.toLowerCase();
            if (p.includes("start") || p.includes("refresh")) return 10;
            if (p.includes("search")) return 25;
            if (p.includes("read") || p.includes("gather")) return 50;
            if (p.includes("filter") || p.includes("analy")) return 70;
            if (p.includes("generat") || p.includes("writ")) return 85;
            if (p.includes("sav")) return 95;
            return 15;
        };

        const getProgressLabel = () => {
            const p = progress.toLowerCase();
            if (p.includes("refresh")) return "Refreshing with latest data...";
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
                {regenerating && (
                    <p className="text-xs text-accent-gold/60 mb-4 uppercase tracking-widest">
                        Regenerating with fresh data...
                    </p>
                )}

                <div className="mb-6">
                    <TriviaLoader />
                </div>

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

    // ─── STATE 3: No review ────────────────────────────────
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