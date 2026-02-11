"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CinemaRoulette from "./CinemaRoulette";

const BROWSE_CATEGORIES = [
    { id: "trending", label: "Trending" },
    { id: "worth-it", label: "Worth It" },
    { id: "hidden-gems", label: "Hidden Gems" },
    { id: "tv-shows", label: "TV Shows" },
    { id: "movies", label: "Movies" },
];

export default function Navbar() {
    const [rouletteOpen, setRouletteOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
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
                                className="text-sm font-medium text-white/70 hover:text-accent-gold transition-colors uppercase tracking-widest hover:underline decoration-accent-gold decoration-2 underline-offset-4"
                            >
                                {cat.label}
                            </Link>
                        ))}

                        {/* 🎰 THE ROULETTE TRIGGER */}
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="text-sm font-bold text-accent-gold hover:text-white transition-colors uppercase tracking-widest ml-4 flex items-center gap-2 cursor-pointer group"
                        >
                            <span className="group-hover:animate-pulse">Can't decide?</span>
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 relative z-50">
                        {/* Mobile Roulette Trigger (Visible on Mobile) */}
                        <button
                            onClick={() => setRouletteOpen(true)}
                            className="md:hidden text-xs font-bold text-accent-gold uppercase tracking-wide mr-2"
                        >
                            Can't decide?
                        </button>

                        <button
                            onClick={handleSearchClick}
                            className="p-2 text-white/80 hover:text-accent-gold transition-colors"
                            aria-label="Search"
                        >
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>

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
                    </div>
                </div>
            </nav>

            {/* 🎰 The Cinema Roulette Modal */}
            <CinemaRoulette
                isOpen={rouletteOpen}
                onClose={() => setRouletteOpen(false)}
            />
        </>
    );
}
