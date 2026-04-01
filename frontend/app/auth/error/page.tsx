"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthErrorPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace("/");
        }, 2000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
            <p className="text-5xl mb-4">🔑</p>
            <h1 className="font-display text-2xl text-white mb-2">
                Sign-in hiccup
            </h1>
            <p className="text-sm text-white/50 mb-6">
                Something went wrong with authentication. Taking you home...
            </p>
            <a
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all"
            >
                Go Home
            </a>
        </div>
    );
}
