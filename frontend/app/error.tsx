"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center animate-fade-in">
            <p className="text-5xl mb-4">⚠️</p>
            <h2 className="font-display text-2xl sm:text-3xl text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-white/50 mb-8 max-w-sm">
                Could be a bad connection or a hiccup on our end.
            </p>
            <div className="flex gap-3">
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all"
                >
                    Try Again
                </button>
                <a
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/20 hover:border-accent-gold/40 hover:text-accent-gold transition-all"
                >
                    Home
                </a>
            </div>
        </div>
    );
}
