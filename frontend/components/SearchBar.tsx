"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface SearchBarProps {
  initialQuery?: string;
  size?: "sm" | "lg";
  placeholder?: string;
}

export default function SearchBar({
  initialQuery = "",
  size = "lg",
  placeholder = "Search any movie or TV show...",
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const isLarge = size === "lg";

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      {/* Search Icon */}
      <div
        className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${focused ? "text-accent-gold" : "text-text-muted"
          }`}
      >
        <svg
          className={isLarge ? "h-5 w-5" : "h-4 w-4"}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className={`w-full border bg-surface-card text-text-primary placeholder-text-muted transition-all ${focused
            ? "border-accent-gold/50 ring-2 ring-accent-gold/20 shadow-lg shadow-accent-gold/5"
            : "border-surface-elevated hover:border-surface-hover"
          } ${isLarge
            ? "rounded-2xl py-4 pl-12 pr-28 text-lg"
            : "rounded-xl py-2.5 pl-10 pr-20 text-sm"
          } focus:outline-none`}
      />

      {/* Submit Button */}
      <button
        type="submit"
        className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-xl bg-accent-gold font-medium text-surface transition-all hover:bg-accent-goldLight active:scale-95 ${isLarge ? "px-5 py-2.5" : "px-3 py-1.5 text-sm"
          }`}
      >
        <span>Search</span>
        <svg
          className={isLarge ? "h-4 w-4" : "h-3 w-3"}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
      </button>

      {/* Keyboard hint */}
      {isLarge && focused && (
        <div className="absolute -bottom-8 left-0 text-xs text-text-muted">
          Press <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono">Enter</kbd> to search
        </div>
      )}
    </form>
  );
}
