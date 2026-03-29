"use client";

import SearchBar from "@/components/SearchBar";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <p className="text-5xl mb-4">🔍</p>
      <h1 className="font-display text-2xl sm:text-3xl text-white mb-2">
        Page not found
      </h1>
      <p className="text-sm text-white/50 mb-8 max-w-md text-center">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>

      <div className="flex gap-3 mb-8">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = "/";
            }
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-white/10 text-white border border-white/20 hover:border-accent-gold/40 hover:text-accent-gold transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Go Back
        </button>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent-gold text-black hover:bg-accent-gold/90 transition-all"
        >
          Home
        </a>
      </div>

      <div className="w-full max-w-md">
        <SearchBar placeholder="Search for a movie or show..." size="lg" />
      </div>
    </div>
  );
}
