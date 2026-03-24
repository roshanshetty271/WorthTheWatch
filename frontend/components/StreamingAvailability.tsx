"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface Provider {
    name: string;
    logo_url: string | null;
    provider_id: number;
}

interface StreamingData {
    available: boolean;
    flatrate: Provider[];
    rent: Provider[];
    buy: Provider[];
    free: Provider[];
    justwatch_link: string;
}

interface Props {
    tmdbId: number;
}

// Compact inline version for hero section
export default function StreamingAvailability({ tmdbId }: Props) {
    const [data, setData] = useState<StreamingData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStreaming = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_BASE}/api/movies/${tmdbId}/streaming`);
                if (!res.ok) throw new Error("Failed to fetch");
                const json = await res.json();
                setData(json);
            } catch {
                // Silent fail
            } finally {
                setLoading(false);
            }
        };

        fetchStreaming();
    }, [tmdbId]);

    if (!data || !data.available) return null;

    const { flatrate, free, justwatch_link } = data;
    const allOptions = [...flatrate, ...free];
    const streamingOptions = allOptions.slice(0, 3);
    const hasMore = allOptions.length > 3 || !!justwatch_link;

    if (streamingOptions.length === 0) return null;

    return (
        <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-gold/80">Watch On</span>
            <div className="flex items-center gap-2">
                {streamingOptions.map((provider) => (
                    <div
                        key={provider.provider_id}
                        className="group relative"
                        title={provider.name}
                    >
                        {provider.logo_url ? (
                            <Image
                                src={provider.logo_url}
                                alt={provider.name}
                                width={28}
                                height={28}
                                className="rounded-md ring-1 ring-white/20 transition-all hover:scale-110 hover:ring-white/40"
                                unoptimized
                            />
                        ) : (
                            <div className="h-7 w-7 rounded-md bg-white/10 flex items-center justify-center text-[10px] text-white/60 font-medium">
                                {provider.name.charAt(0)}
                            </div>
                        )}
                    </div>
                ))}
                {hasMore && justwatch_link && (
                    <a
                        href={justwatch_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-white/60 hover:text-white transition-colors"
                    >
                        More →
                    </a>
                )}
            </div>
        </div>
    );
}
