"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const CinemaRoulette = dynamic(() => import("./CinemaRoulette"), {
    ssr: false,
    loading: () => null,
});
import { useWatchlist } from "@/lib/useWatchlist";
import AuthButton from "./AuthButton";
import NotificationBell from "./NotificationBell";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";

function MobileAuthSection({ onClose }: { onClose: () => void }) {
    const { data: session, status } = useSession();
    const [confirmSignOut, setConfirmSignOut] = useState(false);

    if (status === "loading") return <div className="h-8" />;

    if (!session) {
        return (
            <button
                onClick={() => { onClose(); signIn("google"); }}
                className="w-full py-4 font-body text-sm font-semibold uppercase tracking-widest text-accent-gold hover:text-accent-goldLight transition-colors text-center"
            >
                Sign In
            </button>
        );
    }

    return (
        <div className="flex flex-col items-center gap-4">
            {/* Avatar + Name */}
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-accent-gold/20 flex items-center justify-center text-accent-gold text-lg font-bold shrink-0">
                    {(session.user?.name || "U")[0].toUpperCase()}
                </div>
                <div className="text-left">
                    <p className="text-sm font-medium text-white">{session.user?.name}</p>
                    <p className="text-xs text-text-muted">{session.user?.email}</p>
                </div>
            </div>

            {/* Links */}
            <div className="w-full flex flex-col gap-1">
                <Link
                    href="/profile"
                    onClick={onClose}
                    className="w-full py-3 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold transition-colors text-center border-b border-white/5"
                >
                    My Profile
                </Link>
                <Link
                    href="/history"
                    onClick={onClose}
                    className="w-full py-3 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold transition-colors text-center border-b border-white/5"
                >
                    Watch History
                </Link>
                {!confirmSignOut ? (
                    <button
                        onClick={() => setConfirmSignOut(true)}
                        className="w-full py-3 font-body text-sm font-semibold uppercase tracking-widest text-white/40 hover:text-red-400 transition-colors text-center"
                    >
                        Sign Out
                    </button>
                ) : (
                    <div className="py-3 space-y-3 text-center">
                        <p className="text-xs text-text-muted">Your watchlist will stay saved. Sign out?</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => { onClose(); signOut({ callbackUrl: "/" }); }}
                                className="px-5 py-2 text-xs font-medium rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                            >
                                Sign Out
                            </button>
                            <button
                                onClick={() => setConfirmSignOut(false)}
                                className="px-5 py-2 text-xs font-medium rounded-full bg-white/5 text-text-secondary hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Navbar() {
    const [rouletteOpen, setRouletteOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { count } = useWatchlist();

    useEffect(() => {
        setMounted(true);
        const handleScroll = () => {
            requestAnimationFrame(() => {
                setScrolled(window.scrollY > 10);
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [mobileMenuOpen]);

    const handleSearchClick = () => {
        if (pathname === "/") {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setTimeout(() => {
                const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                searchInput?.focus();
            }, 500);
        } else {
            router.push("/");
        }
    };

    return (
        <>
            <nav
                className={`
                    fixed top-0 left-0 right-0 z-50 py-3 md:py-4
                    transition-colors duration-300 ease-in-out
                    ${scrolled ? "bg-surface" : "bg-transparent"}
                `}
            >
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8">
                    {/* Logo */}
                    <Link href="/" onClick={() => mobileMenuOpen && setMobileMenuOpen(false)} className="flex items-center gap-2 group relative z-50">
                        <span className="font-display text-lg md:text-2xl text-white tracking-tight transition-colors duration-300 text-shadow-hero">
                            Worth the <span className="text-accent-gold group-hover:text-accent-goldLight transition-colors duration-300">Watch</span>?
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-7">
                        <button
                            onClick={() => {
                                if (pathname === "/") {
                                    document.getElementById("now-playing")?.scrollIntoView({ behavior: "smooth" });
                                } else {
                                    router.push("/#now-playing");
                                }
                            }}
                            className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest cursor-pointer text-shadow-hero"
                        >
                            What&apos;s New
                        </button>

                        <Link
                            href="/discover"
                            className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest text-shadow-hero"
                        >
                            Discover
                        </Link>

                        <Link
                            href="/browse/mood/tired"
                            className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest text-shadow-hero"
                        >
                            Mood Based
                        </Link>

                        <Link
                            href="/versus"
                            className="text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-opacity text-shadow-hero"
                        >
                            <span className="text-accent-gold">Movie Battle</span>
                        </Link>

                        {/* Roulette Trigger */}
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="text-sm font-bold text-accent-gold hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2 cursor-pointer group text-shadow-hero"
                        >
                            <span className="group-hover:animate-pulse">Can&apos;t Decide?</span>
                        </button>

                        {/* My List */}
                        <Link
                            href="/my-list"
                            className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest relative text-shadow-hero"
                        >
                            My List
                            {mounted && count > 0 && (
                                <span className="absolute -top-2 -right-4 bg-accent-gold text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                    {count > 9 ? "9+" : count}
                                </span>
                            )}
                        </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4 relative z-50">
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="md:hidden text-[11px] sm:text-sm font-bold text-accent-gold uppercase tracking-wide text-shadow-hero"
                        >
                            Can&apos;t Decide?
                        </button>

                        <div className="hidden md:block">
                            <NotificationBell />
                        </div>

                        <button
                            onClick={handleSearchClick}
                            className="p-2 text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.3))_drop-shadow(0_1px_3px_rgba(0,0,0,1))]"
                            aria-label="Search"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>

                        <div className="hidden md:block">
                            <AuthButton />
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.3))_drop-shadow(0_1px_3px_rgba(0,0,0,1))]"
                            aria-label="Menu"
                        >
                            {mobileMenuOpen ? (
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            ) : (
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

            </nav>

            {/* Mobile Menu Overlay */}
            <div
                className={`
                    fixed inset-0 z-[45] bg-surface/95 backdrop-blur-2xl transition-transform duration-300 md:hidden flex flex-col items-center pt-20 overflow-y-auto
                    ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}
                `}
            >
                {/* Subtle gold accent line at top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-gold/40 to-transparent" />

                <nav className="flex flex-col items-center w-full max-w-xs px-6">
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            if (pathname === "/") {
                                setTimeout(() => {
                                    document.getElementById("now-playing")?.scrollIntoView({ behavior: "smooth" });
                                }, 300);
                            } else {
                                router.push("/#now-playing");
                            }
                        }}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        What&apos;s New
                    </button>
                    <Link
                        href="/discover"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        Discover
                    </Link>
                    <Link
                        href="/browse/mood/tired"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        Mood Based
                    </Link>
                    <Link
                        href="/versus"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        Movie Battle
                    </Link>
                    <Link
                        href="/my-list"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        My List{mounted && count > 0 ? ` (${count})` : ""}
                    </Link>
                    <button
                        onClick={() => { setMobileMenuOpen(false); setRouletteOpen(true); }}
                        className="w-full py-5 font-body text-sm font-bold uppercase tracking-widest text-accent-gold hover:text-accent-goldLight transition-colors text-center"
                    >
                        Can&apos;t Decide?
                    </button>

                    {/* Mobile Auth Section — inline, not dropdown */}
                    <div className="mt-8 w-full border-t border-white/10 pt-6">
                        <MobileAuthSection onClose={() => setMobileMenuOpen(false)} />
                    </div>
                </nav>
            </div>

            <CinemaRoulette
                isOpen={rouletteOpen}
                onClose={() => setRouletteOpen(false)}
            />
        </>
    );
}