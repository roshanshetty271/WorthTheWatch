"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center animate-fade-in">
            <h2 className="font-display text-xl text-white mb-2">This page couldn&apos;t load</h2>
            <p className="text-sm text-text-muted mb-6 max-w-sm">
                Could be a bad connection or a hiccup on our end. Tap below to try again.
            </p>
            <button
                onClick={reset}
                className="px-5 py-2.5 bg-white/10 text-white text-sm font-semibold rounded-xl hover:bg-white/20 active:scale-95 transition-all"
            >
                Try again
            </button>
        </div>
    );
}
