"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

export interface WatchlistItem {
    tmdb_id: number;
    title: string;
    poster_path?: string | null;
    media_type?: string;
    verdict?: string | null;
    added_at?: string;
}

const STORAGE_KEY = "wtw-watchlist";
const SYNC_EVENT = "wtw-watchlist-sync";
const COUNT_CACHE_KEY = "wtw-watchlist-count";

/**
 * Hybrid watchlist hook.
 * 
 * Anonymous users:  localStorage (same as before)
 * Signed-in users:  Database via /api/watchlist endpoints
 * 
 * On first sign-in: localStorage items are migrated to the database.
 */
export function useWatchlist() {
    const { data: session, status } = useSession();
    const isSignedIn = !!session?.user?.id;
    const isLoading = status === "loading";

    const [items, setItems] = useState<WatchlistItem[]>([]);
    const [mounted, setMounted] = useState(false);
    const [cachedCount, setCachedCount] = useState(0);
    const [syncing, setSyncing] = useState(false);

    // ─── Initialize ────────────────────────────────────────

    useEffect(() => {
        setMounted(true);
        // Read cached count for instant badge display
        try {
            const cached = sessionStorage.getItem(COUNT_CACHE_KEY);
            if (cached) setCachedCount(parseInt(cached, 10) || 0);
        } catch { }
    }, []);

    // Load items based on auth state
    useEffect(() => {
        if (!mounted || isLoading) return;

        if (isSignedIn) {
            // Fetch from database
            fetchFromDB();
        } else {
            // Read from localStorage
            loadFromLocalStorage();
        }
    }, [mounted, isSignedIn, isLoading]);

    // Listen for cross-component sync (localStorage mode only)
    useEffect(() => {
        if (isSignedIn) return;

        function handleSync() {
            loadFromLocalStorage();
        }
        window.addEventListener(SYNC_EVENT, handleSync);
        return () => window.removeEventListener(SYNC_EVENT, handleSync);
    }, [isSignedIn]);

    // ─── localStorage helpers ──────────────────────────────

    function loadFromLocalStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                setItems(parsed);
                sessionStorage.setItem(COUNT_CACHE_KEY, String(parsed.length || 0));
            } else {
                setItems([]);
                sessionStorage.setItem(COUNT_CACHE_KEY, "0");
            }
        } catch {
            setItems([]);
        }
    }

    function saveToLocalStorage(newItems: WatchlistItem[]) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
        window.dispatchEvent(new Event(SYNC_EVENT));
    }

    // ─── Database helpers ──────────────────────────────────

    async function fetchFromDB() {
        try {
            const res = await fetch("/api/watchlist");
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);

                // Cache count for instant badge on next page load
                sessionStorage.setItem(COUNT_CACHE_KEY, String(data.items?.length || 0));

                // Migrate localStorage items to DB on first load
                await migrateLocalStorageToDB(data.items || []);
            }
        } catch (error) {
            console.error("Failed to fetch watchlist:", error);
            // Fall back to localStorage
            loadFromLocalStorage();
        }
    }

    async function migrateLocalStorageToDB(dbItems: WatchlistItem[]) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const localItems: WatchlistItem[] = JSON.parse(stored);
            if (localItems.length === 0) return;

            // Find items in localStorage that are NOT in the database
            const dbIds = new Set(dbItems.map((i) => i.tmdb_id));
            const toMigrate = localItems.filter((i) => !dbIds.has(i.tmdb_id));

            if (toMigrate.length === 0) {
                // Already synced, clear localStorage
                localStorage.removeItem(STORAGE_KEY);
                return;
            }

            // Migrate each item
            for (const item of toMigrate) {
                await fetch("/api/watchlist", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item),
                });
            }

            // Clear localStorage after migration
            localStorage.removeItem(STORAGE_KEY);

            // Refetch from DB to get complete list
            const res = await fetch("/api/watchlist");
            if (res.ok) {
                const data = await res.json();
                setItems(data.items || []);
            }

            console.log(`Migrated ${toMigrate.length} watchlist items to database`);
        } catch (error) {
            console.error("Migration failed:", error);
        }
    }

    // ─── Public API ────────────────────────────────────────

    const addItem = useCallback(
        async (item: WatchlistItem) => {
            if (isSignedIn) {
                // Add to database
                try {
                    setSyncing(true);
                    await fetch("/api/watchlist", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(item),
                    });
                    setItems((prev) => {
                        if (prev.some((i) => i.tmdb_id === item.tmdb_id)) return prev;
                        const newItems = [item, ...prev];
                        sessionStorage.setItem(COUNT_CACHE_KEY, String(newItems.length));
                        return newItems;
                    });
                } catch (error) {
                    console.error("Failed to add to watchlist:", error);
                } finally {
                    setSyncing(false);
                }
            } else {
                // Add to localStorage
                setItems((prev) => {
                    if (prev.some((i) => i.tmdb_id === item.tmdb_id)) return prev;
                    const newItems = [item, ...prev];
                    saveToLocalStorage(newItems);
                    sessionStorage.setItem(COUNT_CACHE_KEY, String(newItems.length));
                    return newItems;
                });
            }
        },
        [isSignedIn]
    );

    const removeItem = useCallback(
        async (tmdbId: number) => {
            if (isSignedIn) {
                // Remove from database
                try {
                    setSyncing(true);
                    await fetch(`/api/watchlist/${tmdbId}`, { method: "DELETE" });
                    setItems((prev) => {
                        const newItems = prev.filter((i) => i.tmdb_id !== tmdbId);
                        sessionStorage.setItem(COUNT_CACHE_KEY, String(Math.max(0, newItems.length)));
                        return newItems;
                    });
                } catch (error) {
                    console.error("Failed to remove from watchlist:", error);
                } finally {
                    setSyncing(false);
                }
            } else {
                // Remove from localStorage
                setItems((prev) => {
                    const newItems = prev.filter((i) => i.tmdb_id !== tmdbId);
                    saveToLocalStorage(newItems);
                    sessionStorage.setItem(COUNT_CACHE_KEY, String(Math.max(0, newItems.length)));
                    return newItems;
                });
            }
        },
        [isSignedIn]
    );

    const isInWatchlist = useCallback(
        (tmdbId: number) => {
            return items.some((i) => i.tmdb_id === tmdbId);
        },
        [items]
    );

    const clearAll = useCallback(async () => {
        if (isSignedIn) {
            // Remove all from database
            try {
                setSyncing(true);
                for (const item of items) {
                    await fetch(`/api/watchlist/${item.tmdb_id}`, { method: "DELETE" });
                }
                setItems([]);
            } catch (error) {
                console.error("Failed to clear watchlist:", error);
            } finally {
                setSyncing(false);
            }
        } else {
            setItems([]);
            saveToLocalStorage([]);
        }
    }, [isSignedIn, items]);

    const getShareUrl = useCallback(() => {
        if (!mounted || items.length === 0) return null;
        const ids = items.map((i) => i.tmdb_id).join(",");
        const base = typeof window !== "undefined" ? window.location.origin : "";
        return `${base}/list?ids=${ids}`;
    }, [items, mounted]);

    const toggle = useCallback(
        async (item: WatchlistItem) => {
            if (isInWatchlist(item.tmdb_id)) {
                await removeItem(item.tmdb_id);
                return false;
            } else {
                await addItem(item);
                return true;
            }
        },
        [isInWatchlist, addItem, removeItem]
    );

    return {
        items,
        count: mounted ? (items.length > 0 ? items.length : cachedCount) : 0,
        addItem,
        removeItem,
        isInWatchlist,
        isSaved: isInWatchlist, // Alias for backward compatibility
        toggle,
        clearAll,
        clear: clearAll, // Alias for backward compatibility
        getShareUrl,
        isSignedIn,
        syncing,
        mounted,
    };
}