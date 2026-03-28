"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import SignInDialog from "./SignInDialog";

const CinemaRoulette = dynamic(() => import("./CinemaRoulette"), {
    ssr: false,
    loading: () => null,
});

const FREE_FEATURES = [
    { label: "AI Verdicts", sub: "Instant reviews", action: "search" },
    { label: "Cinema Roulette", sub: "Random pick", action: "roulette" },
    { label: "Movie Battle", sub: "Head-to-head", action: "versus" },
    { label: "Watchlist", sub: "Save locally", action: "watchlist" },
];

const SIGNED_IN_FEATURES = [
    { label: "Cloud Watchlist", sub: "Sync all devices", action: "watchlist" },
    { label: "Taste Profile", sub: "Your movie DNA", action: "profile" },
    { label: "For You", sub: "Personal recs", action: "foryou" },
    { label: "Watch History", sub: "Every lookup", action: "history" },
];

interface FeaturesShowcaseProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FeaturesShowcase({ isOpen, onClose }: FeaturesShowcaseProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [rouletteOpen, setRouletteOpen] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, handleKeyDown]);

    const requireAuth = (cb: () => void) => {
        if (!session?.user) {
            setShowSignIn(true);
            return;
        }
        cb();
    };

    const go = (action: string) => {
        onClose();
        switch (action) {
            case "search":
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => {
                    (document.querySelector('input[type="text"]') as HTMLInputElement)?.focus();
                }, 400);
                break;
            case "roulette":
                setRouletteOpen(true);
                break;
            case "versus":
                router.push("/versus");
                break;
            case "profile":
                router.push("/profile");
                break;
            case "watchlist":
                router.push("/my-list");
                break;
            case "foryou":
                if (window.location.pathname === "/") {
                    document.getElementById("for-you")?.scrollIntoView({ behavior: "smooth" });
                } else {
                    router.push("/#for-you");
                }
                break;
            case "history":
                router.push("/history");
                break;
        }
    };

    if (!mounted) return null;

    const isSignedIn = !!session?.user;

    const GoldCheck = ({ dimmed }: { dimmed?: boolean }) => (
        <svg
            className={`mt-0.5 h-4 w-4 flex-shrink-0 text-accent-gold${dimmed ? " opacity-40" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
    );

    return (
        <>
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
                    onClick={onClose}
                >
                    <div
                        className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-surface-card p-8 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 text-text-muted transition-colors hover:text-white"
                            aria-label="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>

                        <h2 className="font-display text-xl text-white">Everything we offer</h2>
                        <p className="mt-2 text-sm text-accent-gold/80">Oh, we do way more than verdicts.</p>

                        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
                            {FREE_FEATURES.map((f) => (
                                <button
                                    key={f.label}
                                    onClick={() => go(f.action)}
                                    className="group flex items-start gap-3 text-left cursor-pointer"
                                >
                                    <GoldCheck />
                                    <div>
                                        <span className="text-sm font-semibold text-white group-hover:text-accent-gold group-hover:underline underline-offset-2 transition-colors">{f.label}</span>
                                        <span className="block text-xs text-text-muted">{f.sub}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="my-5 flex items-center gap-3">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-xs text-text-muted">Sign in for more</span>
                            <div className="h-px flex-1 bg-white/10" />
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                            {SIGNED_IN_FEATURES.map((f) => (
                                <button
                                    key={f.label}
                                    onClick={() => {
                                        if (isSignedIn) {
                                            go(f.action);
                                        } else {
                                            requireAuth(() => go(f.action));
                                        }
                                    }}
                                    className="group flex items-start gap-3 text-left cursor-pointer"
                                >
                                    <GoldCheck dimmed={!isSignedIn} />
                                    <div>
                                        <span className={`text-sm font-semibold group-hover:underline underline-offset-2 transition-colors ${isSignedIn ? "text-white group-hover:text-accent-gold" : "text-white/50 group-hover:text-white/70"}`}>
                                            {f.label}
                                        </span>
                                        <span className="block text-xs text-text-muted">{f.sub}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {!isSignedIn && (
                            <button
                                onClick={() => { onClose(); setShowSignIn(true); }}
                                className="mt-7 w-full rounded-xl bg-accent-gold px-6 py-3 font-bold text-black transition-colors hover:bg-accent-goldLight"
                            >
                                Sign in to unlock
                            </button>
                        )}
                    </div>
                </div>,
                document.body
            )}

            <CinemaRoulette isOpen={rouletteOpen} onClose={() => setRouletteOpen(false)} />
            <SignInDialog
                open={showSignIn}
                onClose={() => setShowSignIn(false)}
                context="Sign in to unlock your full experience — synced watchlist, taste profile, and personalized picks."
            />
        </>
    );
}
