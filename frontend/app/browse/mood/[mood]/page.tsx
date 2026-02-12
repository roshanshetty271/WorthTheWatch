"use client";

import { useParams } from "next/navigation";
import MoodBrowsePage from "@/components/MoodBrowsePage";

const VALID_MOODS = ["tired", "pumped", "emotional", "cerebral", "fun"];

export default function Page() {
    const params = useParams();
    const mood = params.mood as string;

    if (!VALID_MOODS.includes(mood)) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] pt-28 flex items-center justify-center">
                <p className="text-white/40">Invalid mood. Try tired, pumped, emotional, cerebral, or fun.</p>
            </div>
        );
    }

    return <MoodBrowsePage mood={mood} />;
}