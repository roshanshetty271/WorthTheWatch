"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SearchResult {
  tmdb_id: number;
  title: string;
  media_type: string;
  poster_path?: string;
  poster_url?: string;
  release_date?: string;
  tmdb_vote_average?: number;
  has_review?: boolean;
}

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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/search/quick?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setShowDropdown(data.results?.length > 0);
        }
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setShowDropdown(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowDropdown(false);
    }
  }

  const isLarge = size === "lg";

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative w-full">
        {/* Search Icon */}
        <div
          className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${focused ? "text-accent-gold" : "text-text-muted"
            }`}
        >
          {loading ? (
            <div className={`${isLarge ? "h-5 w-5" : "h-4 w-4"} animate-spin rounded-full border-2 border-accent-gold border-t-transparent`} />
          ) : (
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
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setFocused(true);
            if (results.length > 0) setShowDropdown(true);
          }}
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
      </form>

      {/* Dropdown Results */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-surface-card border border-surface-elevated rounded-xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
          {results.map((movie) => {
            const year = movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : "";
            const posterUrl =
              movie.poster_url ||
              (movie.poster_path
                ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
                : null);

            return (
              <Link
                href={`/movie/${movie.tmdb_id}`}
                key={movie.tmdb_id}
                onClick={() => setShowDropdown(false)}
                className="flex items-center gap-3 p-3 hover:bg-surface-hover transition-colors cursor-pointer border-b border-surface-elevated last:border-b-0"
              >
                {posterUrl ? (
                  <Image
                    src={posterUrl}
                    alt={movie.title}
                    width={40}
                    height={56}
                    className="w-10 h-14 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-14 rounded bg-surface-elevated flex items-center justify-center flex-shrink-0">
                    <span className="text-text-muted text-xs">🎬</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {movie.title}
                  </p>
                  <p className="text-xs text-text-muted">
                    {year && `${year} • `}
                    <span className="capitalize">{movie.media_type}</span>
                    {movie.tmdb_vote_average && movie.tmdb_vote_average > 0 && (
                      <> • ⭐ {movie.tmdb_vote_average.toFixed(1)}</>
                    )}
                  </p>
                </div>
                {movie.has_review && (
                  <span className="text-xs text-verdict-worth font-medium flex-shrink-0">
                    ✅ Reviewed
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Keyboard hint */}
      {isLarge && focused && !showDropdown && (
        <div className="absolute -bottom-8 left-0 text-xs text-text-muted">
          Press{" "}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono">
            Enter
          </kbd>{" "}
          to search
        </div>
      )}
    </div>
  );
}
