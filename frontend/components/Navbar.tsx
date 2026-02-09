"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const BROWSE_CATEGORIES = [
    { id: "trending", label: "🔥 Trending" },
    { id: "worth-it", label: "✅ Worth It" },
    { id: "hidden-gems", label: "💎 Hidden Gems" },
    { id: "tv-shows", label: "📺 TV Shows" },
    { id: "movies", label: "🎬 Movies" },
];

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [browseOpen, setBrowseOpen] = useState(false);
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

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setBrowseOpen(false);
        if (browseOpen) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [browseOpen]);

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

    const buttonBaseStyles = scrolled
        ? "bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-transparent"
        : "bg-white/10 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/20 hover:text-white";

    return (
        <nav
            className={`
                fixed top-0 left-0 right-0 z-50 
                transition-[background-color,backdrop-filter] duration-500 ease-out
                ${scrolled ? "bg-surface/90 backdrop-blur-xl" : "bg-transparent backdrop-blur-none"}
            `}
        >
            <div
                className={`
                    absolute bottom-0 left-0 right-0 h-px bg-white/10
                    transition-opacity duration-500
                    ${scrolled ? "opacity-100" : "opacity-0"}
                `}
            />

            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between px-4 py-3 md:px-8 md:py-4">
                <Link href="/" className="flex items-center gap-2 group">
                    <span className="font-display text-xl sm:text-2xl text-accent-gold drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] transition-all duration-300">
                        Worth the Watch?
                    </span>
                </Link>

                <div className="flex items-center gap-1.5 sm:gap-3">
                    {/* Browse Dropdown */}
                    <div className="relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setBrowseOpen(!browseOpen);
                            }}
                            className={`rounded-full px-3 sm:px-4 py-2 text-sm transition-all duration-300 flex items-center gap-1 ${buttonBaseStyles}`}
                        >
                            <span className="hidden sm:inline">Browse</span>
                            <span className="sm:hidden">📁</span>
                            <svg
                                className={`h-3 w-3 transition-transform ${browseOpen ? "rotate-180" : ""}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {browseOpen && (
                            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-card border border-surface-elevated shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {BROWSE_CATEGORIES.map((cat) => (
                                    <Link
                                        key={cat.id}
                                        href={`/browse/${cat.id}`}
                                        className="block px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-elevated hover:text-text-primary transition-colors"
                                        onClick={() => setBrowseOpen(false)}
                                    >
                                        {cat.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Search Button */}
                    <button
                        onClick={handleSearchClick}
                        className={`rounded-full px-3 sm:px-4 py-2 text-sm transition-all duration-300 ${buttonBaseStyles}`}
                    >
                        <span className="hidden sm:inline">Search</span>
                        <span className="sm:hidden">🔍</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}

