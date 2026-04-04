"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

export default function AuthButton({ onSignInClick }: { onSignInClick?: () => void } = {}) {
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

    // Show "Sign In" during loading AND when not signed in — no layout shift
    if (status === "loading" || !session) {
        return (
            <button
                onClick={() => {
                    if (status === "loading") return;
                    onSignInClick ? onSignInClick() : signIn("google", { callbackUrl: window.location.href });
                }}
                className={`text-base md:text-sm font-medium text-white/80 hover:text-accent-gold
                   transition-colors uppercase tracking-widest ${status === "loading" ? "pointer-events-none" : ""}`}
                aria-label="Sign in with Google"
            >
                Sign In
            </button>
        );
    }

    // Signed in — show avatar with dropdown
    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 group p-1"
                aria-label="Account menu"
            >
                {session.user?.image ? (
                    <img
                        src={session.user.image}
                        alt={session.user.name || "User"}
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-transparent group-hover:ring-accent-gold/50 transition-all"
                        referrerPolicy="no-referrer"
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

                    {/* Menu links */}
                    <Link
                        href="/profile"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                        </svg>
                        My Profile
                    </Link>
                    <Link
                        href="/history"
                        onClick={() => setShowMenu(false)}
                        className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                    >
                        <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Watch History
                    </Link>

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