"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useWatchlist } from "@/lib/useWatchlist";
import SignInDialog from "./SignInDialog";

interface BookmarkButtonProps {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    verdict: string | null;
    variant?: "card" | "page";
    className?: string;
}

export default function BookmarkButton({
    tmdb_id,
    title,
    poster_path,
    verdict,
    variant = "card",
    className = "",
}: BookmarkButtonProps) {
    const { data: session } = useSession();
    const { isSaved, toggle, guestLimitReached, mounted: watchlistMounted } = useWatchlist();
    const [saved, setSaved] = useState(false);
    const [pop, setPop] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && watchlistMounted) {
            setSaved(isSaved(tmdb_id));
        }
    }, [isSaved, tmdb_id, mounted, watchlistMounted]);

    const handleClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!session?.user && guestLimitReached && !saved) {
            setShowSignIn(true);
            return;
        }

        const nowSaved = await toggle({ tmdb_id, title, poster_path, verdict });
        setSaved(nowSaved);
        setPop(true);
        setTimeout(() => setPop(false), 300);
    };

    const iconSize = variant === "card" ? "w-4 h-4" : "w-5 h-5";
    const icon = (
        <svg
            className={iconSize}
            fill={saved ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
        </svg>
    );

    if (variant === "card") {
        return (
            <>
                <button
                    onClick={handleClick}
                    className={`
          absolute top-1.5 right-1.5 z-10 p-2.5 rounded-full
          transition-all duration-200
          ${saved ? "bg-accent-gold/90 text-black" : "bg-black/50 text-white/70 hover:text-white hover:bg-black/70"}
          ${pop ? "scale-125" : "scale-100"}
          backdrop-blur-sm
          ${className}
        `}
                    aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
                >
                    {icon}
                </button>
                <SignInDialog
                    open={showSignIn}
                    onClose={() => setShowSignIn(false)}
                    context="You've saved 3 movies! Sign in to save unlimited movies and sync across devices."
                />
            </>
        );
    }

    return (
        <>
            <button
                onClick={handleClick}
                className={`
        inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
        text-sm font-semibold transition-all duration-200
        ${saved
                        ? "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                        : "bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:border-accent-gold/40 hover:bg-accent-gold/5 hover:text-accent-gold"
                    }
        ${pop ? "scale-105" : "scale-100"}
        ${className}
      `}
                aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
            >
                {saved ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                ) : (
                    icon
                )}
                {saved ? "Saved to Watchlist" : "Add to Watchlist"}
            </button>
            <SignInDialog
                open={showSignIn}
                onClose={() => setShowSignIn(false)}
                context="You've saved 3 movies! Sign in to save unlimited movies and sync across devices."
            />
        </>
    );
}
