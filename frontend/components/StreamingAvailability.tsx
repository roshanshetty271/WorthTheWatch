"use client";

import { useEffect, useState, useRef } from "react";

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

const streamingCache = new Map<number, StreamingData>();

interface Props {
    tmdbId: number;
    initialData?: StreamingData | null;
}

// Seed cache from server-side data
function seedCache(tmdbId: number, data: StreamingData | null | undefined) {
    if (data && !streamingCache.has(tmdbId)) {
        streamingCache.set(tmdbId, data);
    }
}

export default function StreamingAvailability({ tmdbId, initialData }: Props) {
    // Seed cache immediately from server-side prop
    if (initialData) seedCache(tmdbId, initialData);

    const [data, setData] = useState<StreamingData | null>(
        () => streamingCache.get(tmdbId) ?? initialData ?? null
    );
    const [loading, setLoading] = useState(!streamingCache.has(tmdbId) && !initialData);
    const fetchedRef = useRef(false);

    useEffect(() => {
        // Prevent double-fetch in strict mode
        if (fetchedRef.current) return;

        if (streamingCache.has(tmdbId)) {
            setData(streamingCache.get(tmdbId)!);
            setLoading(false);
            return;
        }

        fetchedRef.current = true;

        const fetchStreaming = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_BASE}/api/movies/${tmdbId}/streaming`);
                if (!res.ok) throw new Error("Failed to fetch");
                const json: StreamingData = await res.json();
                streamingCache.set(tmdbId, json);
                setData(json);
            } catch {
                // Mark as unavailable so we don't keep retrying
                const empty: StreamingData = {
                    available: false,
                    flatrate: [],
                    rent: [],
                    buy: [],
                    free: [],
                    justwatch_link: "",
                };
                streamingCache.set(tmdbId, empty);
                setData(empty);
            } finally {
                setLoading(false);
            }
        };

        fetchStreaming();
    }, [tmdbId]);

    // Always render the container to prevent layout shift.
    // If loading or no data, render an invisible placeholder with the same height.
    const hasData = data?.available && [...(data.flatrate || []), ...(data.free || [])].length > 0;

    if (loading || !hasData) return null;

    const { flatrate, free, justwatch_link } = data!;
    const allOptions = [...flatrate, ...free];
    const streamingOptions = allOptions.slice(0, 3);
    const hasMore = allOptions.length > 3 || !!justwatch_link;

    return (
        <div className="flex items-center gap-2.5 animate-fade-in">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent-gold/80">Watch On</span>
            <div className="flex items-center gap-2">
                {streamingOptions.map((provider) => (
                    <div
                        key={provider.provider_id}
                        className="group relative"
                        title={provider.name}
                    >
                        {provider.logo_url ? (
                            <img
                                src={provider.logo_url}
                                alt={provider.name}
                                width={36}
                                height={36}
                                className="rounded-md ring-1 ring-white/20 transition-all hover:scale-110 hover:ring-white/40"
                            />
                        ) : (
                            <div className="h-9 w-9 rounded-md bg-white/10 flex items-center justify-center text-xs text-white/60 font-medium">
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
                        className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                        More →
                    </a>
                )}
            </div>
        </div>
    );
}
