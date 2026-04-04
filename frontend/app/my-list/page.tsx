import { Suspense } from "react";
import type { Metadata } from "next";
import MyListPage from "@/components/MyListPage";

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function Page() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0a0a0a] pt-28 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            </div>
        }>
            <MyListPage />
        </Suspense>
    );
}
