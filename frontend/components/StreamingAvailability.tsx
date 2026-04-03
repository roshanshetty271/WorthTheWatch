"use client";

import { useEffect, useState, useRef } from "react";

interface Provider {
    name: string;
    logo_url: string | null;
    provider_id: number;
    web_url?: string | null;
}

interface StreamingData {
    available: boolean;
    flatrate: Provider[];
    rent: Provider[];
    buy: Provider[];
    free: Provider[];
    justwatch_link: string;
}

const streamingCache = new Map<string, StreamingData>();

function cacheKey(tmdbId: number, mediaType: string) {
    return `${mediaType}:${tmdbId}`;
}

interface Props {
    tmdbId: number;
    mediaType?: string;
    initialData?: StreamingData | null;
}

// Seed cache from server-side data
function seedCache(key: string, data: StreamingData | null | undefined) {
    if (data && !streamingCache.has(key)) {
        streamingCache.set(key, data);
    }
}

export default function StreamingAvailability({ tmdbId, mediaType = "movie", initialData }: Props) {
    const key = cacheKey(tmdbId, mediaType);
    // Seed cache immediately from server-side prop
    if (initialData) seedCache(key, initialData);

    const [data, setData] = useState<StreamingData | null>(
        () => streamingCache.get(key) ?? initialData ?? null
    );
    const [loading, setLoading] = useState(!streamingCache.has(key) && !initialData);
    const fetchedRef = useRef(false);
    const prevKeyRef = useRef(key);

    // Reset when title changes (client-side navigation)
    useEffect(() => {
        if (prevKeyRef.current !== key) {
            prevKeyRef.current = key;
            fetchedRef.current = false;
            const cached = streamingCache.get(key);
            if (cached) {
                setData(cached);
                setLoading(false);
            } else {
                setData(initialData ?? null);
                setLoading(true);
            }
        }
    }, [key, initialData]);

    useEffect(() => {
        if (fetchedRef.current) return;

        if (streamingCache.has(key)) {
            setData(streamingCache.get(key)!);
            setLoading(false);
            return;
        }

        fetchedRef.current = true;

        const fetchStreaming = async () => {
            try {
                const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                const res = await fetch(`${API_BASE}/api/movies/${tmdbId}/streaming?media_type=${mediaType}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const json: StreamingData = await res.json();
                streamingCache.set(key, json);
                setData(json);
            } catch {
                const empty: StreamingData = {
                    available: false,
                    flatrate: [],
                    rent: [],
                    buy: [],
                    free: [],
                    justwatch_link: "",
                };
                streamingCache.set(key, empty);
                setData(empty);
            } finally {
                setLoading(false);
            }
        };

        fetchStreaming();
    }, [tmdbId, mediaType, key]);

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
                {streamingOptions.map((provider) => {
                    const href = provider.web_url || justwatch_link;
                    const Wrapper = href ? "a" : "div";
                    const linkProps = href ? { href, target: "_blank", rel: "noopener noreferrer" } : {};
                    return (
                        <Wrapper
                            key={provider.provider_id}
                            {...linkProps}
                            className="group relative cursor-pointer"
                            title={`Watch on ${provider.name}`}
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
                        </Wrapper>
                    );
                })}
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
