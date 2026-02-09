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

    if (loading) {
        return (
            <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-white/10 animate-pulse"></div>
                <div className="h-6 w-6 rounded bg-white/10 animate-pulse"></div>
            </div>
        );
    }

    if (!data || !data.available) {
        return null;
    }

    const { flatrate, free, justwatch_link } = data;
    const streamingOptions = [...flatrate, ...free].slice(0, 5);

    if (streamingOptions.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5 pt-4">
            <span className="font-display text-base sm:text-lg text-accent-gold flex items-center gap-2">
                📺 Watch On
            </span>
            <div className="flex flex-wrap items-center gap-3">
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
                                width={36}
                                height={36}
                                className="rounded-lg ring-2 ring-white/20 transition-all hover:scale-110 hover:ring-white/40"
                                unoptimized
                            />
                        ) : (
                            <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/60 font-medium">
                                {provider.name.charAt(0)}
                            </div>
                        )}
                    </div>
                ))}
                {justwatch_link && (
                    <a
                        href={justwatch_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-white/50 hover:text-white/80 transition-colors ml-1"
                    >
                        More →
                    </a>
                )}
            </div>
        </div>
    );
}
