"use client";

import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
const CinemaRoulette = dynamic(() => import("./CinemaRoulette"), {
    ssr: false,
    loading: () => null,
});
import { useWatchlist } from "@/lib/useWatchlist";
import AuthButton from "./AuthButton";
import SignInDialog from "./SignInDialog";
import FeaturesShowcase from "./FeaturesShowcase";
import { useSession, signOut } from "next-auth/react";

function MobileAuthSection({ onClose, onSignInClick }: { onClose: () => void; onSignInClick: () => void }) {
    const { data: session, status } = useSession();
    const [confirmSignOut, setConfirmSignOut] = useState(false);

    if (status === "loading") return <div className="h-8" />;

    if (!session) {
        return (
            <button
                onClick={() => { onClose(); onSignInClick(); }}
                className="w-full py-5 font-body text-sm font-bold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors text-center border-b border-white/10"
            >
                Sign In
            </button>
        );
    }

    return (
        <div className="w-full pt-8 flex flex-col items-center gap-4">
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
    const [exploreOpen, setExploreOpen] = useState(false);
    const [exploreExpanded, setExploreExpanded] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);
    const [featuresOpen, setFeaturesOpen] = useState(false);
    const exploreRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    const { count } = useWatchlist();
    const { data: session } = useSession();
    const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

    useEffect(() => {
        const handleScroll = () => {
            requestAnimationFrame(() => {
                setScrolled(window.scrollY > 10);
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
                setExploreOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
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

                        <button
                            onClick={() => setFeaturesOpen(true)}
                            className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest cursor-pointer text-shadow-hero"
                        >
                            Features
                        </button>

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

                        {/* Explore Dropdown */}
                        <div className="relative" ref={exploreRef}>
                            <button
                                onClick={() => setExploreOpen(!exploreOpen)}
                                className="text-sm font-medium text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors uppercase tracking-widest cursor-pointer text-shadow-hero flex items-center gap-1.5"
                            >
                                Explore
                                <svg
                                    className={`w-3 h-3 transition-transform duration-200 ${exploreOpen ? "rotate-180" : ""}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            {exploreOpen && (
                                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-surface-card border border-white/10 shadow-2xl py-2 z-50 animate-fade-in">
                                    <Link
                                        href="/browse/mood/tired"
                                        onClick={() => setExploreOpen(false)}
                                        className="block w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="text-sm text-text-secondary">Mood Based</span>
                                        <span className="block text-[11px] text-text-muted mt-0.5">Pick a vibe, get a match</span>
                                    </Link>
                                    <Link
                                        href="/versus"
                                        onClick={() => setExploreOpen(false)}
                                        className="block w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="text-sm text-text-secondary">Movie Battle</span>
                                        <span className="block text-[11px] text-text-muted mt-0.5">Two movies enter, AI picks the winner</span>
                                    </Link>

                                    <div className="my-1 mx-3 border-t border-white/5" />

                                    <button
                                        onClick={() => {
                                            setExploreOpen(false);
                                            if (!session?.user) { setShowSignIn(true); return; }
                                            router.push("/profile");
                                        }}
                                        className="block w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="text-sm text-text-secondary">Taste Profile</span>
                                        <span className="block text-[11px] text-text-muted mt-0.5">Your stats, top genres, favorite eras, and recs</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setExploreOpen(false);
                                            if (!session?.user) { setShowSignIn(true); return; }
                                            router.push("/history");
                                        }}
                                        className="block w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="text-sm text-text-secondary">Watch History</span>
                                        <span className="block text-[11px] text-text-muted mt-0.5">Everything you&apos;ve looked up</span>
                                    </button>

                                    <div className="my-1 mx-3 border-t border-white/5" />

                                    <Link
                                        href="/contact"
                                        onClick={() => setExploreOpen(false)}
                                        className="block w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                                    >
                                        <span className="text-sm text-text-secondary">Contact Us</span>
                                        <span className="block text-[11px] text-text-muted mt-0.5">Bug reports, feedback, or just say hi</span>
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 sm:gap-4 relative z-50">
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="md:hidden text-[11px] sm:text-sm font-bold text-accent-gold uppercase tracking-wide text-shadow-hero"
                        >
                            Can&apos;t Decide?
                        </button>

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
                            <AuthButton onSignInClick={() => setShowSignIn(true)} />
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
                    <button
                        onClick={() => {
                            setMobileMenuOpen(false);
                            setFeaturesOpen(true);
                        }}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        Features
                    </button>

                    <Link
                        href="/my-list"
                        onClick={() => setMobileMenuOpen(false)}
                        className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors border-b border-white/10 text-center"
                    >
                        My List{mounted && count > 0 ? ` (${count})` : ""}
                    </Link>

                    {/* Explore — collapsible accordion */}
                    <div className="w-full border-b border-white/10">
                        <button
                            onClick={() => setExploreExpanded(!exploreExpanded)}
                            className="w-full py-5 font-body text-sm font-semibold uppercase tracking-widest text-white/80 hover:text-accent-gold active:text-accent-gold transition-colors text-center flex items-center justify-center gap-2"
                        >
                            Explore
                            <svg
                                className={`w-3 h-3 transition-transform duration-200 ${exploreExpanded ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {exploreExpanded && (
                            <div className="animate-fade-in pb-3 flex flex-col items-center gap-0.5">
                                <Link
                                    href="/browse/mood/tired"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-3 font-body text-xs font-medium uppercase tracking-widest text-text-secondary hover:text-accent-gold transition-colors text-center"
                                >
                                    Mood Based
                                </Link>
                                <Link
                                    href="/versus"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-3 font-body text-xs font-medium uppercase tracking-widest text-text-secondary hover:text-accent-gold transition-colors text-center"
                                >
                                    Movie Battle
                                </Link>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        if (!session?.user) { setShowSignIn(true); return; }
                                        router.push("/profile");
                                    }}
                                    className="w-full py-3 font-body text-xs font-medium uppercase tracking-widest text-text-secondary hover:text-accent-gold transition-colors text-center"
                                >
                                    Taste Profile
                                </button>
                                <button
                                    onClick={() => {
                                        setMobileMenuOpen(false);
                                        if (!session?.user) { setShowSignIn(true); return; }
                                        router.push("/history");
                                    }}
                                    className="w-full py-3 font-body text-xs font-medium uppercase tracking-widest text-text-secondary hover:text-accent-gold transition-colors text-center"
                                >
                                    Watch History
                                </button>
                                <Link
                                    href="/contact"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-3 font-body text-xs font-medium uppercase tracking-widest text-text-secondary hover:text-accent-gold transition-colors text-center"
                                >
                                    Contact Us
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Mobile Auth Section */}
                    <div className="w-full">
                        <MobileAuthSection onClose={() => setMobileMenuOpen(false)} onSignInClick={() => setShowSignIn(true)} />
                    </div>
                </nav>
            </div>

            <CinemaRoulette
                isOpen={rouletteOpen}
                onClose={() => setRouletteOpen(false)}
            />
            <SignInDialog
                open={showSignIn}
                onClose={() => setShowSignIn(false)}
                context="Sign in to unlock your full experience — unlimited verdicts, synced watchlist, and personalized picks."
            />
            <FeaturesShowcase
                isOpen={featuresOpen}
                onClose={() => setFeaturesOpen(false)}
            />
        </>
    );
}
