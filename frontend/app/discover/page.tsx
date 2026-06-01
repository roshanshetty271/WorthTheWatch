/**
 * Worth the Watch? — Discover Page
 * /discover — Advanced filtering by genre, year, rating
 */
import { Suspense } from "react";
import DiscoverPage from "@/components/DiscoverPage";

export const metadata = {
    title: "Genre Picks",
    description: "Pick your genres and get movies the internet says are actually worth it — filter by year, rating, and more.",
    alternates: { canonical: "https://worth-the-watch.com/discover" },
    openGraph: {
        title: "Genre Picks — Worth the Watch?",
        description: "Pick your genres and get movies the internet says are actually worth it — filter by year, rating, and more.",
        images: ["/twitter-share.jpg"],
    },
    twitter: {
        card: "summary_large_image" as const,
        title: "Genre Picks — Worth the Watch?",
        description: "Pick your genres and get movies the internet says are actually worth it — filter by year, rating, and more.",
        images: ["/twitter-share.jpg"],
    },
};

export default function Discover() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#d4a843]/30 border-t-[#d4a843] rounded-full animate-spin" />
                </div>
            }
        >
            <DiscoverPage />
        </Suspense>
    );
}