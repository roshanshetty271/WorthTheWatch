"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface TasteProfile {
    topGenres: { name: string; count: number }[];
    topDecades: { name: string; count: number }[];
    stats: {
        views: number;
        generations: number;
        battles: number;
        rouletteSpins: number;
        totalActivity: number;
        savedMovies: number;
        moviesVsTv: { movies: number; tv: number };
    };
    userName: string;
    userImage: string | null;
}

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [profile, setProfile] = useState<TasteProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (status === "loading") return;
        if (!session?.user) {
            router.push("/");
            return;
        }

        fetch("/api/profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) setProfile(data);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [session, status, router]);

    if (status === "loading" || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-accent-gold/30 border-t-accent-gold rounded-full animate-spin" />
            </div>
        );
    }

    if (!session?.user) return null;

    if (error || !profile) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
                <p className="text-4xl mb-4">😵</p>
                <h2 className="font-display text-xl text-white mb-2">Couldn&apos;t load your profile</h2>
                <p className="text-sm text-text-muted mb-6">Check your connection and try again. If it keeps happening, try signing out and back in.</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-5 py-2.5 bg-white/10 text-white text-sm font-semibold rounded-xl hover:bg-white/20 active:scale-95 transition-all"
                >
                    Refresh
                </button>
            </div>
        );
    }

    const maxGenreCount = profile.topGenres[0]?.count || 1;
    const hasEnoughData = profile.stats.totalActivity >= 3;

    return (
        <div className="min-h-screen pt-24 md:pt-28 pb-16">
            <div className="mx-auto max-w-3xl px-4">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-14 w-14 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold text-2xl font-bold ring-2 ring-accent-gold/30 shrink-0">
                        {(profile.userName || "U")[0].toUpperCase()}
                    </div>
                    <div>
                        <h1 className="font-display text-2xl md:text-3xl text-white">
                            {profile.userName}
                        </h1>
                        <p className="text-sm text-text-secondary">Your taste profile</p>
                    </div>
                </div>

                {/* Activity Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    {[
                        { label: "Movies Explored", value: profile.stats.views, icon: "👁" },
                        { label: "Verdicts Generated", value: profile.stats.generations, icon: "⚡" },
                        { label: "Battles Played", value: profile.stats.battles, icon: "⚔️" },
                        { label: "Roulette Spins", value: profile.stats.rouletteSpins, icon: "🎰" },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-xl border border-white/10 bg-surface-card p-4 text-center"
                        >
                            <p className="text-2xl mb-1">{stat.icon}</p>
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-xs text-text-muted uppercase tracking-wider mt-1">
                                {stat.label}
                            </p>
                        </div>
                    ))}
                </div>

                {!hasEnoughData ? (
                    <div className="rounded-2xl border border-white/10 bg-surface-card p-12 text-center">
                        <p className="text-4xl mb-4">🎬</p>
                        <h2 className="font-display text-xl text-text-primary mb-2">
                            Keep exploring!
                        </h2>
                        <p className="text-sm text-text-secondary mb-6 max-w-sm mx-auto">
                            View a few more movies to build your taste profile. We need at least 3 interactions to detect patterns.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-gold text-black font-bold rounded-xl text-sm hover:bg-accent-goldLight transition-colors"
                        >
                            Discover movies
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Top Genres */}
                        {profile.topGenres.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-surface-card p-6">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">
                                    Your Top Genres
                                </h2>
                                <div className="space-y-3">
                                    {profile.topGenres.map((genre) => (
                                        <div key={genre.name} className="flex items-center gap-3">
                                            <span className="text-sm text-white w-24 truncate font-medium">
                                                {genre.name}
                                            </span>
                                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-accent-gold rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${(genre.count / maxGenreCount) * 100}%`,
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs text-text-muted w-8 text-right">
                                                {genre.count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Favorite Decades */}
                        {profile.topDecades.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-surface-card p-6">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">
                                    Favorite Eras
                                </h2>
                                <div className="flex flex-wrap gap-2">
                                    {profile.topDecades.map((decade, i) => (
                                        <span
                                            key={decade.name}
                                            className={`px-4 py-2 rounded-full text-sm font-medium border ${
                                                i === 0
                                                    ? "bg-accent-gold/10 text-accent-gold border-accent-gold/30"
                                                    : "bg-white/5 text-text-secondary border-white/10"
                                            }`}
                                        >
                                            {decade.name}
                                            <span className="text-xs ml-1.5 opacity-60">({decade.count})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Movies vs TV */}
                        {(profile.stats.moviesVsTv.movies > 0 || profile.stats.moviesVsTv.tv > 0) && (
                            <div className="rounded-2xl border border-white/10 bg-surface-card p-6">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-4">
                                    Movies vs TV Shows
                                </h2>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
                                            {profile.stats.moviesVsTv.movies > 0 && (
                                                <div
                                                    className="bg-accent-gold h-full"
                                                    style={{
                                                        width: `${(profile.stats.moviesVsTv.movies / (profile.stats.moviesVsTv.movies + profile.stats.moviesVsTv.tv)) * 100}%`,
                                                    }}
                                                />
                                            )}
                                            {profile.stats.moviesVsTv.tv > 0 && (
                                                <div
                                                    className="bg-purple-500 h-full"
                                                    style={{
                                                        width: `${(profile.stats.moviesVsTv.tv / (profile.stats.moviesVsTv.movies + profile.stats.moviesVsTv.tv)) * 100}%`,
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-2 text-xs">
                                    <span className="text-accent-gold font-medium">
                                        Movies ({profile.stats.moviesVsTv.movies})
                                    </span>
                                    <span className="text-purple-400 font-medium">
                                        TV ({profile.stats.moviesVsTv.tv})
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Quick Links */}
                        <div className="flex gap-3 pt-2">
                            <Link
                                href="/history"
                                className="flex-1 text-center py-3 rounded-xl border border-white/10 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                            >
                                View History
                            </Link>
                            <Link
                                href="/my-list"
                                className="flex-1 text-center py-3 rounded-xl border border-white/10 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                            >
                                My List ({profile.stats.savedMovies})
                            </Link>
                        </div>
                    </div>
                )}

                {/* Email Preferences */}
                <EmailPreferences />

                {/* Danger Zone */}
                <DangerZone />
            </div>
        </div>
    );
}

function EmailPreferences() {
    const [freq, setFreq] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/user-preferences")
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (d?.digest_frequency) setFreq(d.digest_frequency); })
            .catch(() => {});
    }, []);

    const update = async (value: string) => {
        const prev = freq;
        setFreq(value);
        setSaving(true);
        try {
            const res = await fetch("/api/user-preferences", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ digest_frequency: value }),
            });
            if (!res.ok) setFreq(prev);
        } catch {
            setFreq(prev);
        } finally {
            setSaving(false);
        }
    };

    const options = [
        { v: "monthly", l: "Monthly" },
        { v: "weekly", l: "Weekly" },
        { v: "off", l: "Off" },
    ];

    return (
        <div className="mt-8 rounded-2xl border border-white/10 bg-surface-card p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">
                Worth-It Digest
            </h2>
            <p className="text-sm text-text-secondary mb-4 max-w-md">
                The best new <span className="text-accent-gold font-medium">Worth It</span> picks
                plus whatever&apos;s blowing up — straight to your inbox. No spam; unsubscribe in one tap.
            </p>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
                {options.map((o) => (
                    <button
                        key={o.v}
                        onClick={() => update(o.v)}
                        disabled={saving || freq === null}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
                            freq === o.v
                                ? "bg-accent-gold text-black"
                                : "text-text-secondary hover:text-white"
                        }`}
                    >
                        {o.l}
                    </button>
                ))}
            </div>
        </div>
    );
}

function DangerZone() {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    return (
        <div className="mt-12 border-t border-red-500/10 pt-8">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-red-400/60 mb-4">Danger Zone</h3>
            {!confirmDelete ? (
                <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 transition-colors"
                >
                    Delete Account
                </button>
            ) : (
                <div className="max-w-md space-y-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                    <p className="text-sm text-red-300/80">
                        This will permanently delete your account, watchlist, lists, and all activity. This cannot be undone.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={async () => {
                                setDeleting(true);
                                try {
                                    const res = await fetch("/api/account/delete", { method: "DELETE" });
                                    if (res.ok) {
                                        signOut({ callbackUrl: "/" });
                                    }
                                } catch {
                                    // user can retry
                                } finally {
                                    setDeleting(false);
                                }
                            }}
                            disabled={deleting}
                            className="px-5 py-2 text-xs font-bold rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                        >
                            {deleting ? "Deleting..." : "Delete Forever"}
                        </button>
                        <button
                            onClick={() => setConfirmDelete(false)}
                            className="px-5 py-2 text-xs font-medium rounded-xl bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
