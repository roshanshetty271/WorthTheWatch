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

const FEATURES = [
    {
        title: "AI Verdicts",
        description: "Search any title. Get a verdict in 15 seconds.",
        action: "search" as const,
        gated: false,
    },
    {
        title: "Cinema Roulette",
        description: "Can\u2019t decide? We\u2019ll pick one worth watching.",
        action: "roulette" as const,
        gated: false,
    },
    {
        title: "Movie Battle",
        description: "Pit two movies against each other. AI picks the winner.",
        action: "versus" as const,
        gated: false,
    },
    {
        title: "Taste Profile",
        description: "Your stats, top genres, favorite eras, and movie DNA.",
        action: "profile" as const,
        gated: true,
    },
    {
        title: "Watchlist",
        description: "Save picks. Sync everywhere. Never forget a good rec.",
        action: "watchlist" as const,
        gated: true,
    },
    {
        title: "For You",
        description: "Recs built around your taste, not just what\u2019s trending.",
        action: "foryou" as const,
        gated: true,
    },
    {
        title: "Watch History",
        description: "Everything you\u2019ve looked up, all in one place.",
        action: "history" as const,
        gated: true,
    },
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

    const handleAction = (action: string) => {
        onClose();
        switch (action) {
            case "search":
                window.scrollTo({ top: 0, behavior: "smooth" });
                setTimeout(() => {
                    const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                    input?.focus();
                }, 400);
                break;
            case "roulette":
                setRouletteOpen(true);
                break;
            case "versus":
                router.push("/versus");
                break;
            case "profile":
                requireAuth(() => router.push("/profile"));
                break;
            case "watchlist":
                requireAuth(() => router.push("/my-list"));
                break;
            case "foryou":
                requireAuth(() => {
                    if (window.location.pathname === "/") {
                        document.getElementById("for-you")?.scrollIntoView({ behavior: "smooth" });
                    } else {
                        router.push("/#for-you");
                    }
                });
                break;
            case "history":
                requireAuth(() => router.push("/history"));
                break;
        }
    };

    if (!mounted) return null;

    return (
        <>
            {isOpen && createPortal(
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
                    onClick={onClose}
                >
                    <div
                        className="relative mx-4 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-surface-card px-6 py-5 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 text-text-muted transition-colors hover:text-white"
                            aria-label="Close"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </button>

                        {/* Header */}
                        <h2 className="font-display text-lg text-white">Everything we offer</h2>
                        <p className="mt-1 text-sm text-accent-gold/80">Oh, we do way more than verdicts.</p>

                        {/* Feature grid — 2 columns */}
                        <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-0">
                            {FEATURES.map((feature) => (
                                <button
                                    key={feature.title}
                                    onClick={() => handleAction(feature.action)}
                                    className="group flex items-start gap-2.5 w-full text-left py-1.5 transition-colors hover:bg-white/[0.03] rounded-lg px-1 -mx-1"
                                >
                                    <svg
                                        className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-accent-gold"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                        strokeWidth={2.5}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                    <div>
                                        <span className="text-sm font-medium text-white group-hover:text-accent-gold transition-colors">
                                            {feature.title}
                                        </span>
                                        <span className="block text-[11px] text-text-muted leading-tight mt-0.5">
                                            {feature.description}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {!session?.user && (
                            <button
                                onClick={() => { onClose(); setShowSignIn(true); }}
                                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-accent-goldLight"
                            >
                                Sign in to unlock everything
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
                context="Sign in to unlock your full experience — unlimited verdicts, synced watchlist, and personalized picks."
            />
        </>
    );
}
