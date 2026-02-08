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
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  const sizeClasses =
    size === "lg"
      ? "px-6 py-4 text-lg rounded-2xl"
      : "px-4 py-2.5 text-sm rounded-xl";

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-surface-card border border-surface-elevated text-text-primary placeholder-text-muted focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors ${sizeClasses}`}
      />
      <button
        type="submit"
        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent-gold/10 text-accent-gold transition-colors hover:bg-accent-gold/20 ${
          size === "lg" ? "px-5 py-2.5" : "px-3 py-1.5 text-sm"
        }`}
      >
        Search
      </button>
    </form>
  );
}
