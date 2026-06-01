/**
 * Worth the Watch? — Genre Picks
 * /picks — pick genre(s), match any/all → Worth-It picks first, then a broad catalog.
 */
import { Suspense } from "react";
import PicksPage from "@/components/PicksPage";

export const metadata = {
    title: "Genre Picks",
    description: "Pick your genres and get movies the internet says are actually worth it — no duds.",
    alternates: { canonical: "https://worth-the-watch.com/picks" },
    openGraph: {
        title: "Genre Picks — Worth the Watch?",
        description: "Pick your genres and get movies the internet says are actually worth it — no duds.",
        images: ["/twitter-share.jpg"],
    },
    twitter: {
        card: "summary_large_image" as const,
        title: "Genre Picks — Worth the Watch?",
        description: "Pick your genres and get movies the internet says are actually worth it — no duds.",
        images: ["/twitter-share.jpg"],
    },
};

export default function Picks() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#d4a843]/30 border-t-[#d4a843] rounded-full animate-spin" />
                </div>
            }
        >
            <PicksPage />
        </Suspense>
    );
}
