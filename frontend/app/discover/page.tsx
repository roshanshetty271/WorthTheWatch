/**
 * Worth the Watch? — Discover Page
 * /discover — Advanced filtering by genre, year, rating
 */
import { Suspense } from "react";
import DiscoverPage from "@/components/DiscoverPage";

export const metadata = {
    title: "Discover — Worth the Watch?",
    description: "Find exactly what you want to watch. Filter by genre, year, rating, and more.",
    openGraph: {
        title: "Discover — Worth the Watch?",
        description: "Find exactly what you want to watch. Filter by genre, year, rating, and more.",
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