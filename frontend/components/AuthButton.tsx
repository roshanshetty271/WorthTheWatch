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
                className="text-sm font-medium text-white/80 hover:text-accent-gold 
                   transition-colors uppercase tracking-widest"
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