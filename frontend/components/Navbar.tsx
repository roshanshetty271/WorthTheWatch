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

const BROWSE_CATEGORIES = [
    { id: "trending", label: "Trending" },
    { id: "tv-shows", label: "TV Shows" },
    { id: "movies", label: "Movies" },
];

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
                setScrolled(window.scrollY > 80);
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

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
                    fixed top-0 left-0 right-0 z-50 
                    transition-all duration-500 ease-out
                    ${scrolled ? "bg-surface/95 backdrop-blur-md py-3" : "bg-gradient-to-b from-black/80 to-transparent py-3 md:py-5"}
                `}
            >
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 md:px-8">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2 group relative z-50">
                        <span className="font-display text-2xl md:text-3xl text-white tracking-tight group-hover:text-accent-gold transition-colors duration-300">
                            Worth the <span className="text-accent-gold">Watch</span>?
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-8">
                        {BROWSE_CATEGORIES.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/browse/${cat.id}`}
                                className="text-sm font-medium text-white/80 hover:text-accent-gold transition-colors uppercase tracking-widest hover:underline decoration-accent-gold decoration-2 underline-offset-4"
                            >
                                {cat.label}
                            </Link>
                        ))}

                        {/* My List */}
                        <Link
                            href="/my-list"
                            className="text-sm font-medium text-white/80 hover:text-accent-gold transition-colors uppercase tracking-widest hover:underline decoration-accent-gold decoration-2 underline-offset-4 relative"
                        >
                            My List
                            {mounted && count > 0 && (
                                <span className="absolute -top-2 -right-4 bg-accent-gold text-black text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                    {count > 9 ? "9+" : count}
                                </span>
                            )}
                        </Link>

                        {/* Movie Battle + Can't decide? = Feature links */}
                        <div className="flex items-center gap-8 ml-8 border-l border-white/10 pl-8">
                            <Link
                                href="/versus"
                                className="text-sm font-bold uppercase tracking-widest hover:opacity-80 transition-opacity"
                            >
                                <span className="text-white">Movie </span><span className="text-accent-gold">Battle</span>
                            </Link>

                            {/* Roulette Trigger */}
                            <button
                                onClick={() => setRouletteOpen(true)}
                                className="text-sm font-bold text-accent-gold hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2 cursor-pointer group"
                            >
                                <span className="group-hover:animate-pulse">Can&apos;t decide?</span>
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 relative z-50">
                        {/* Mobile Roulette Trigger */}
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="md:hidden text-xs font-bold text-accent-gold uppercase tracking-wide mr-2"
                        >
                            Can&apos;t decide?
                        </button>

                        {/* My List icon (mobile) */}
                        <Link
                            href="/my-list"
                            className="md:hidden p-2 text-white hover:text-accent-gold transition-colors relative"
                            aria-label="My List"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            {mounted && count > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 bg-accent-gold text-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">
                                    {count > 9 ? "9+" : count}
                                </span>
                            )}
                        </Link>

                        <button
                            onClick={handleSearchClick}
                            className="p-2 text-white/80 hover:text-accent-gold transition-colors"
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
                            className="md:hidden p-2 text-white/80 hover:text-accent-gold transition-colors"
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

                {/* Mobile Menu Overlay */}
                <div
                    className={`
                        fixed inset-0 z-40 bg-surface/95 backdrop-blur-xl transition-transform duration-300 md:hidden flex items-center justify-center
                        ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}
                    `}
                >
                    <div className="flex flex-col items-center gap-8">
                        {BROWSE_CATEGORIES.map((cat) => (
                            <Link
                                key={cat.id}
                                href={`/browse/${cat.id}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="font-display text-3xl text-white hover:text-accent-gold transition-colors"
                            >
                                {cat.label}
                            </Link>
                        ))}
                        <Link
                            href="/my-list"
                            onClick={() => setMobileMenuOpen(false)}
                            className="font-display text-3xl text-white hover:text-accent-gold transition-colors"
                        >
                            My List{mounted && count > 0 ? ` (${count})` : ""}
                        </Link>
                        <Link
                            href="/versus"
                            onClick={() => setMobileMenuOpen(false)}
                            className="font-display text-3xl text-white hover:text-accent-gold transition-colors"
                        >
                            Movie Battle
                        </Link>

                        <div className="mt-4">
                            <AuthButton />
                        </div>
                    </div>
                </div>
            </nav>

            <CinemaRoulette
                isOpen={rouletteOpen}
                onClose={() => setRouletteOpen(false)}
            />
        </>
    );
}