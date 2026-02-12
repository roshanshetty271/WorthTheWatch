"use client";

import { useState, useEffect } from "react";
import { useWatchlist } from "@/lib/useWatchlist";

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
    const { isSaved, toggle } = useWatchlist();
    const [saved, setSaved] = useState(false);
    const [pop, setPop] = useState(false);

    useEffect(() => {
        setSaved(isSaved(tmdb_id));
    }, [isSaved, tmdb_id]);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const nowSaved = toggle({ tmdb_id, title, poster_path, verdict });
        setSaved(nowSaved);
        setPop(true);
        setTimeout(() => setPop(false), 300);
    };

    const icon = (
        <svg
            className={variant === "card" ? "w-4 h-4" : "w-4 h-4"}
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
            <button
                onClick={handleClick}
                className={`
          absolute top-2 right-2 z-10 p-1.5 rounded-full
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
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl
        text-sm font-medium transition-all duration-200
        ${saved ? "bg-accent-gold/10 text-accent-gold border border-accent-gold/30" : "bg-white/5 text-white/60 border border-white/10 hover:text-white hover:border-white/20"}
        ${pop ? "scale-105" : "scale-100"}
        ${className}
      `}
            aria-label={saved ? "Remove from watchlist" : "Add to watchlist"}
        >
            {icon}
            {saved ? "Saved" : "Save"}
        </button>
    );
}