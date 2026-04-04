"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    const errorMessages: Record<string, { title: string; description: string }> = {
        OAuthSignin: {
            title: "Could not start sign-in",
            description: "There was a problem connecting to Google. This usually resolves itself — try again.",
        },
        OAuthCallback: {
            title: "Sign-in interrupted",
            description: "The sign-in flow was interrupted or timed out. Please try again.",
        },
        OAuthAccountNotLinked: {
            title: "Account already exists",
            description: "This email is already linked to a different sign-in method. Try signing in the way you originally used.",
        },
        Default: {
            title: "Sign-in hiccup",
            description: "Something went wrong with authentication. This is usually temporary.",
        },
    };

    const { title, description } = errorMessages[error || ""] || errorMessages.Default;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
            <p className="text-5xl mb-4">🔑</p>
            <h1 className="font-display text-2xl text-white mb-2">{title}</h1>
            <p className="text-sm text-white/50 mb-8 max-w-md">{description}</p>
            <div className="flex gap-3">
                <button
                    onClick={() => signIn("google", { callbackUrl: "/" })}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all"
                >
                    Try Again
                </button>
                <a
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/5 text-white/80 hover:bg-white/10 transition-all"
                >
                    Go Home
                </a>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            </div>
        }>
            <AuthErrorContent />
        </Suspense>
    );
}
