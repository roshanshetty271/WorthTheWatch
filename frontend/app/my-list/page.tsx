import { Suspense } from "react";
import MyListPage from "@/components/MyListPage";

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
