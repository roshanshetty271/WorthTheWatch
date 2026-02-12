"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

const MOODS = [
    {
        id: "tired",
        label: "Tired",
        subtitle: "Easy watches to unwind",
        poster: "/images/movie5.webp",
    },
    {
        id: "pumped",
        label: "Pumped",
        subtitle: "High-octane adrenaline",
        poster: "/images/movie8.jpg",
    },
    {
        id: "emotional",
        label: "Emotional",
        subtitle: "Hit me in the feels",
        poster: "/images/movie22.jpg",
    },
    {
        id: "cerebral",
        label: "Cerebral",
        subtitle: "Make me think",
        poster: "/images/movie7.jpg",
    },
    {
        id: "fun",
        label: "Fun",
        subtitle: "Keep it light",
        poster: "/images/movie27.webp",
    },
];

export default function MoodSection() {
    const router = useRouter();

    return (
        <section className="py-8">
            {/* Header — identical to HorizontalSection */}
            <div className="flex items-end justify-between mb-6 px-4 sm:px-0">
                <div className="border-l-4 border-accent-gold pl-3 sm:pl-4">
                    <h2 className="font-body text-xl sm:text-2xl font-bold tracking-wide text-white uppercase">
                        What&apos;s Your Mood?
                    </h2>
                </div>
            </div>

            {/* Horizontal Scroll — identical container to HorizontalSection */}
            <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-pl-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                {MOODS.map((mood) => (
                    <div
                        key={mood.id}
                        className="snap-start shrink-0 w-[160px] sm:w-[190px] md:w-[220px]"
                    >
                        <button
                            onClick={() => router.push(`/browse/mood/${mood.id}`)}
                            className="w-full text-left cursor-pointer group"
                        >
                            {/* Card — identical structure to MovieCard */}
                            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-surface-card transition-all duration-500 ease-out ring-1 ring-white/10 shadow-2xl hover:-translate-y-2">
                                {/* Poster */}
                                <div className="absolute inset-0 z-0">
                                    <Image
                                        src={mood.poster}
                                        alt={mood.label}
                                        fill
                                        sizes="(max-width: 768px) 160px, (max-width: 1200px) 190px, 220px"
                                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                                    />
                                </div>

                                {/* Overlays — same as MovieCard */}
                                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />

                                {/* Bottom content — same as MovieCard */}
                                <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4 transition-transform duration-300 bg-gradient-to-t from-black via-black/80 to-transparent">
                                    <h3 className="font-display text-base sm:text-lg font-bold leading-tight text-white transition-all duration-300 group-hover:text-accent-gold">
                                        {mood.label}
                                    </h3>
                                    <div className="mt-2 flex items-center gap-3 text-xs font-medium text-white/70">
                                        {mood.subtitle}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                ))}
            </div>
        </section>
    );
}