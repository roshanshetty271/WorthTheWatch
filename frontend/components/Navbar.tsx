"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Use requestAnimationFrame for smoother updates
            requestAnimationFrame(() => {
                setScrolled(window.scrollY > 80);
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={`
        fixed top-0 left-0 right-0 z-50 
        transition-[background-color,backdrop-filter] duration-500 ease-out
        ${scrolled
                    ? "bg-surface/90 backdrop-blur-xl"
                    : "bg-transparent backdrop-blur-none"
                }
      `}
        >
            {/* Bottom border - always present but opacity changes */}
            <div
                className={`
          absolute bottom-0 left-0 right-0 h-px bg-white/10
          transition-opacity duration-500
          ${scrolled ? "opacity-100" : "opacity-0"}
        `}
            />

            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
                <Link href="/" className="flex items-center gap-2 group">
                    <span
                        className="font-display text-xl sm:text-2xl text-accent-gold drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_0_12px_rgba(234,179,8,0.5)] transition-all duration-300"
                    >
                        Worth the Watch?
                    </span>
                </Link>
                <Link
                    href="/search"
                    className={`
            rounded-full px-4 py-2 text-sm transition-all duration-300
            ${scrolled
                            ? "bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary border border-transparent"
                            : "bg-white/10 backdrop-blur-md border border-white/10 text-white/90 hover:bg-white/20 hover:text-white"
                        }
          `}
                >
                    Search
                </Link>
            </div>
        </nav>
    );
}
