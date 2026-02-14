"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

export default function AuthButton() {
    const { data: session, status } = useSession();
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [confirmSignOut, setConfirmSignOut] = useState(false);

    // Close menu on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
                setConfirmSignOut(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Don't show anything while loading — prevents flash
    if (status === "loading") {
        return <div className="h-8 w-8" />;
    }

    // Not signed in
    if (!session) {
        return (
            <button
                onClick={() => signIn("google")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg 
                   text-sm font-medium text-surface bg-accent-gold
                   hover:bg-accent-goldLight transition-all duration-200"
                aria-label="Sign in with Google"
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#1a1a1a" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#1a1a1a" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#1a1a1a" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#1a1a1a" />
                </svg>
                Sign In
            </button>
        );
    }

    // Signed in — show avatar with dropdown
    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 group"
                aria-label="Account menu"
            >
                {session.user?.image ? (
                    <Image
                        src={session.user.image}
                        alt={session.user.name || "User"}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-transparent group-hover:ring-accent-gold/50 transition-all"
                    />
                ) : (
                    <div className="h-8 w-8 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold text-sm font-bold">
                        {(session.user?.name || "U")[0].toUpperCase()}
                    </div>
                )}
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface-card border border-white/10 shadow-2xl py-2 z-50 animate-fade-in">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-sm font-medium text-white truncate">
                            {session.user?.name}
                        </p>
                        <p className="text-xs text-text-muted truncate">
                            {session.user?.email}
                        </p>
                    </div>

                    {/* Sign out */}
                    {!confirmSignOut ? (
                        <button
                            onClick={() => setConfirmSignOut(true)}
                            className="w-full text-left px-4 py-2.5 text-sm text-text-secondary 
               hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Sign Out
                        </button>
                    ) : (
                        <div className="px-4 py-3 space-y-2 border-t border-white/5">
                            <p className="text-xs text-text-muted">
                                Your watchlist will stay saved. Sign out?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowMenu(false);
                                        setConfirmSignOut(false);
                                        signOut({ callbackUrl: "/" });
                                    }}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg 
                   bg-stone-500/20 text-stone-300 hover:bg-white/10 
                   transition-colors"
                                >
                                    Sign Out
                                </button>
                                <button
                                    onClick={() => setConfirmSignOut(false)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg 
                   bg-white/5 text-text-secondary hover:bg-white/10 
                   transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}