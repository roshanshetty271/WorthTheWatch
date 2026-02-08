"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import VerdictBadge from "@/components/VerdictBadge";
import {
  searchMovies,
  triggerGeneration,
  checkGenerationStatus,
  type SearchResult,
  type MovieWithReview,
} from "@/lib/api";

// Wrap in Suspense because useSearchParams requires it in Next.js 14+
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl space-y-8">
          <div>
            <h1 className="mb-4 font-display text-2xl text-text-primary">Search</h1>
            <div className="skeleton h-14 w-full rounded-2xl" />
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedMovie, setGeneratedMovie] = useState<MovieWithReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setGeneratedMovie(null);

    try {
      const data = await searchMovies(q);
      setResult(data);

      // If found in DB, we're done
      if (data.found_in_db && data.movie) {
        setGeneratedMovie(data.movie);
      }
      // If generating in background, poll for completion
      else if (data.generation_status === "generating" && data.tmdb_results?.[0]) {
        setGenerating(true);
        pollForCompletion(data.tmdb_results[0].tmdb_id);
      }
    } catch (e) {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for generation completion
  async function pollForCompletion(tmdbId: number) {
    const maxAttempts = 30; // 30 * 2s = 60 seconds max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const status = await checkGenerationStatus(tmdbId);
        if (status.status === "completed" && status.movie) {
          setGeneratedMovie(status.movie);
          setGenerating(false);
          return;
        }
      } catch {
        // Keep polling
      }
    }
    setGenerating(false);
    setError("Review generation is taking longer than expected. Please try again later.");
  }

  // Handle manual generation trigger
  async function handleGenerate(tmdbId: number, mediaType: string) {
    setGenerating(true);
    setError(null);
    try {
      await triggerGeneration(tmdbId, mediaType);
      pollForCompletion(tmdbId);
    } catch (e: any) {
      setGenerating(false);
      if (e?.message?.includes("429")) {
        setError("Rate limit reached. Please try again in a few minutes.");
      } else {
        setError("Generation failed. Please try again.");
      }
    }
  }

  useEffect(() => {
    if (query) doSearch(query);
  }, [query, doSearch]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="mb-4 font-display text-2xl text-text-primary">Search</h1>
        <SearchBar initialQuery={query} size="lg" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 rounded-xl bg-surface-card p-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
          <span className="text-text-secondary">Searching...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-verdict-skip/10 border border-verdict-skip/20 p-4 text-sm text-verdict-skip">
          {error}
        </div>
      )}

      {/* Generating Animation */}
      {generating && (
        <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 p-6 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-accent-gold border-t-transparent" />
          <p className="font-display text-lg text-accent-gold">
            Analyzing articles and discussions...
          </p>
          <p className="mt-2 text-sm text-text-muted">
            Reading reviews from across the internet. This takes 10-15 seconds.
          </p>
        </div>
      )}

      {/* Generated Review Result */}
      {generatedMovie && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-text-primary">Result</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <MovieCard data={generatedMovie} />
            </div>
            {generatedMovie.review && (
              <div className="rounded-xl border border-surface-elevated bg-surface-card p-5 sm:col-span-3">
                <div className="mb-3 flex items-center gap-3">
                  <VerdictBadge verdict={generatedMovie.review.verdict} size="md" />
                  {generatedMovie.review.vibe && (
                    <span className="text-sm italic text-text-muted">
                      {generatedMovie.review.vibe}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">
                  {generatedMovie.review.review_text}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TMDB Results (not yet in our DB) */}
      {!generatedMovie && result?.tmdb_results && result.tmdb_results.length > 0 && !generating && (
        <div className="space-y-4">
          <h2 className="font-display text-xl text-text-primary">
            Found on TMDB — Generate a Review
          </h2>
          {result.tmdb_results.map((movie) => (
            <div
              key={movie.tmdb_id}
              className="flex items-center gap-4 rounded-xl border border-surface-elevated bg-surface-card p-4"
            >
              <div className="flex-1">
                <h3 className="font-display text-text-primary">{movie.title}</h3>
                <p className="mt-1 text-xs text-text-muted">
                  {movie.release_date
                    ? new Date(movie.release_date).getFullYear()
                    : ""}{" "}
                  • {movie.media_type}
                </p>
              </div>
              <button
                onClick={() => handleGenerate(movie.tmdb_id, movie.media_type)}
                className="shrink-0 rounded-lg bg-accent-gold/10 px-4 py-2 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold/20"
              >
                Generate Review
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && !generating && !generatedMovie && query && result?.tmdb_results?.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-4 text-text-secondary">
            No results found for &ldquo;{query}&rdquo;. Try a different search.
          </p>
        </div>
      )}
    </div>
  );
}
