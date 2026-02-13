"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "wtw_watchlist";
const SYNC_EVENT = "wtw-watchlist-sync";

export interface WatchlistItem {
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    verdict: string | null;
    added_at: number;
}

// Read from localStorage
function readStorage(): WatchlistItem[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Write to localStorage + notify all other hook instances
function writeStorage(items: WatchlistItem[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch { }
    // Dispatch custom event so every useWatchlist() instance re-reads
    window.dispatchEvent(new Event(SYNC_EVENT));
}

export function useWatchlist() {
    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [mounted, setMounted] = useState(false);

    // Load on mount
    useEffect(() => {
        setMounted(true);
        setItems(readStorage());
    }, []);

    // Listen for sync events from OTHER hook instances
    useEffect(() => {
        if (!mounted) return;
        const handler = () => setItems(readStorage());
        window.addEventListener(SYNC_EVENT, handler);
        // Also listen for storage events (other tabs)
        window.addEventListener("storage", handler);
        return () => {
            window.removeEventListener(SYNC_EVENT, handler);
            window.removeEventListener("storage", handler);
        };
    }, [mounted]);

    const add = useCallback(
        (movie: { tmdb_id: number; title: string; poster_path: string | null; verdict: string | null }) => {
            if (typeof window === "undefined") return;
            const current = readStorage();
            if (current.some((item) => item.tmdb_id === movie.tmdb_id)) return;
            const newItems = [{ ...movie, added_at: Date.now() }, ...current];
            writeStorage(newItems);
            setItems(newItems);
        },
        []
    );

    const remove = useCallback((tmdb_id: number) => {
        if (typeof window === "undefined") return;
        const current = readStorage();
        const newItems = current.filter((item) => item.tmdb_id !== tmdb_id);
        writeStorage(newItems);
        setItems(newItems);
    }, []);

    const isSaved = useCallback(
        (tmdb_id: number) => items.some((item) => item.tmdb_id === tmdb_id),
        [items]
    );

    const toggle = useCallback(
        (movie: { tmdb_id: number; title: string; poster_path: string | null; verdict: string | null }) => {
            if (isSaved(movie.tmdb_id)) {
                remove(movie.tmdb_id);
                return false;
            } else {
                add(movie);
                return true;
            }
        },
        [isSaved, add, remove]
    );

    const clear = useCallback(() => {
        if (typeof window === "undefined") return;
        writeStorage([]);
        setItems([]);
    }, []);

    const getShareUrl = useCallback(() => {
        if (!mounted || items.length === 0) return null;
        const ids = items.map((i) => i.tmdb_id).join(",");
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return `${base}/list?ids=${ids}`;
    }, [items, mounted]);

    return {
        items: mounted ? items : [],
        count: mounted ? items.length : 0,
        mounted,
        add,
        remove,
        isSaved,
        toggle,
        clear,
        getShareUrl
    };
}
