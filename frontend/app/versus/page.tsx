/**
 * Worth the Watch? — Versus Page
 * /versus — AI-powered 1v1 movie battles
 */
import { Suspense } from "react";
import Versus from "@/components/Versus";

export const metadata = {
    title: "Versus — Movie Battles",
    description: "Two movies enter. One leaves victorious. AI-powered movie battles with devastating wit.",
    alternates: { canonical: "https://worth-the-watch.com/versus" },
    openGraph: {
        title: "Versus — Worth the Watch?",
        description: "Two movies enter. One leaves victorious. AI-powered movie battles with devastating wit.",
        images: ["/twitter-share.jpg"],
    },
    twitter: {
        card: "summary_large_image" as const,
        title: "Versus — Worth the Watch?",
        description: "Two movies enter. One leaves victorious. AI-powered movie battles with devastating wit.",
        images: ["/twitter-share.jpg"],
    },
};

export default function VersusPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#d4a843]/30 border-t-[#d4a843] rounded-full animate-spin" />
                </div>
            }
        >
            <Versus />
        </Suspense>
    );
}