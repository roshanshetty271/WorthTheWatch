"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import VerdictBadge from "@/components/VerdictBadge";
import {
  searchMovies,
  triggerGeneration,
  checkGenerationStatus,
  type SearchResult,
  type MovieWithReview,
  type Movie,
} from "@/lib/api";

// Wrap in Suspense because useSearchParams requires it in Next.js 14+
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl space-y-8 px-4">
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
  const [progress, setProgress] = useState<string>("Initializing...");
  const [generatedMovie, setGeneratedMovie] = useState<MovieWithReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTmdbId, setSelectedTmdbId] = useState<number | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setGeneratedMovie(null);
    setSelectedTmdbId(null);

    try {
      const data = await searchMovies(q);
      setResult(data);
      // Always show disambiguation UI - don't auto-select DB match
    } catch (e) {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for generation completion
  async function pollForCompletion(tmdbId: number) {
    const maxAttempts = 45; // 45 * 2s = 90 seconds max (increased for safety)
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const status = await checkGenerationStatus(tmdbId);

        if (status.progress) {
          setProgress(status.progress);
        }

        if (status.status === "completed" && status.movie) {
          setGeneratedMovie(status.movie);
          setGenerating(false);
          setSelectedTmdbId(null);
          return;
        }
      } catch {
        // Keep polling
      }
    }
    setGenerating(false);
    setSelectedTmdbId(null);
    setError("Review generation is taking longer than expected. Please try again later.");
  }

  // Handle generation trigger for a specific title
  async function handleGenerate(movie: Movie) {
    setGenerating(true);
    setProgress("Initializing...");
    setSelectedTmdbId(movie.tmdb_id);
    setError(null);
    try {
      await triggerGeneration(movie.tmdb_id, movie.media_type);
      pollForCompletion(movie.tmdb_id);
    } catch (e: any) {
      setGenerating(false);
      setSelectedTmdbId(null);
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
    <div className="mx-auto max-w-4xl space-y-8 px-4">
      {/* Search Header */}
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
        <div className="rounded-xl border border-accent-gold/20 bg-accent-gold/5 p-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-gold/30 border-t-accent-gold" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-accent-gold">
                AI
              </div>
            </div>
            <div>
              <p className="font-display text-lg text-accent-gold animate-pulse">
                {progress}
              </p>
              <p className="mt-1 text-sm text-text-muted">
                Analyzing reviews from Rotten Tomatoes, Reddit, and IMDB.
              </p>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-accent-gold/10">
            <div className="h-full animate-progress bg-accent-gold/50" style={{ width: '60%' }}></div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          GENERATED REVIEW RESULT — Premium Redesigned UI
          ═══════════════════════════════════════════════════════════════════ */}
      {generatedMovie && (
        <div className="space-y-6">
          {/* Result Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-text-primary">Your Verdict</h2>
            <button
              onClick={() => {
                setGeneratedMovie(null);
                setResult(null);
              }}
              className="text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              ← Search again
            </button>
          </div>

          {/* Main Result Card */}
          <div className="rounded-2xl border border-surface-elevated bg-gradient-to-br from-surface-card to-surface-elevated overflow-hidden">
            {/* Verdict Header */}
            {generatedMovie.review && (
              <div className="border-b border-surface-elevated bg-surface-card/50 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <VerdictBadge verdict={generatedMovie.review.verdict} size="lg" />
                  <div className="flex-1">
                    <h3 className="font-display text-xl text-text-primary">
                      {generatedMovie.movie.title}
                    </h3>
                    {generatedMovie.review.vibe && (
                      <p className="mt-1 text-sm italic text-text-muted">
                        "{generatedMovie.review.vibe}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    {generatedMovie.movie.release_date && (
                      <span>{new Date(generatedMovie.movie.release_date).getFullYear()}</span>
                    )}
                    <span>•</span>
                    <span className="capitalize">{generatedMovie.movie.media_type}</span>
                    {generatedMovie.movie.tmdb_vote_average && (
                      <>
                        <span>•</span>
                        <span>⭐ {generatedMovie.movie.tmdb_vote_average.toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Content Grid */}
            <div className="p-5">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Poster */}
                <div className="shrink-0 mx-auto md:mx-0">
                  <div className="relative w-48 aspect-[2/3] rounded-xl overflow-hidden shadow-lg">
                    {generatedMovie.movie.poster_url ? (
                      <Image
                        src={generatedMovie.movie.poster_url}
                        alt={generatedMovie.movie.title}
                        fill
                        className="object-cover"
                        sizes="200px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-surface-elevated">
                        <span className="text-5xl">🎬</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Review Content */}
                {generatedMovie.review && (
                  <div className="flex-1 space-y-5">
                    {/* Praise & Criticism Points */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Praise Points */}
                      {generatedMovie.review.praise_points && generatedMovie.review.praise_points.length > 0 && (
                        <div className="rounded-xl bg-verdict-worth/10 border border-verdict-worth/20 p-4">
                          <h4 className="flex items-center gap-2 font-display text-sm text-verdict-worth mb-3">
                            <span className="text-lg">👍</span> What People Loved
                          </h4>
                          <ul className="space-y-2">
                            {generatedMovie.review.praise_points.slice(0, 4).map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                <span className="text-verdict-worth mt-0.5">✓</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Criticism Points */}
                      {generatedMovie.review.criticism_points && generatedMovie.review.criticism_points.length > 0 && (
                        <div className="rounded-xl bg-verdict-skip/10 border border-verdict-skip/20 p-4">
                          <h4 className="flex items-center gap-2 font-display text-sm text-verdict-skip mb-3">
                            <span className="text-lg">👎</span> What People Hated
                          </h4>
                          <ul className="space-y-2">
                            {generatedMovie.review.criticism_points.slice(0, 4).map((point, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                <span className="text-verdict-skip mt-0.5">✗</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Review Text */}
                    <div>
                      <h4 className="font-display text-sm text-text-muted mb-2">The Consensus</h4>
                      <p className="text-sm leading-relaxed text-text-secondary">
                        {generatedMovie.review.review_text}
                      </p>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted pt-2 border-t border-surface-elevated">
                      {generatedMovie.review.sources_count && (
                        <span className="flex items-center gap-1">
                          📰 {generatedMovie.review.sources_count} sources analyzed
                        </span>
                      )}
                      {generatedMovie.review.confidence && (
                        <span className="flex items-center gap-1">
                          🎯 {generatedMovie.review.confidence} confidence
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="border-t border-surface-elevated bg-surface-card/30 p-4 flex justify-center gap-4">
              <Link
                href={`/movie/${generatedMovie.movie.tmdb_id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-gold/10 px-5 py-2.5 text-sm font-medium text-accent-gold transition-colors hover:bg-accent-gold/20"
              >
                View Full Review →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DISAMBIGUATION UI — Multiple Matches Found
          ═══════════════════════════════════════════════════════════════════ */}
      {!generatedMovie && result?.tmdb_results && result.tmdb_results.length > 0 && !generating && (
        <div className="space-y-4">
          <div>
            <h2 className="font-display text-xl text-text-primary">
              {result.tmdb_results.length === 1
                ? "Found a Match"
                : `Found ${result.tmdb_results.length} Titles`}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              Select a title to view or generate a review.
            </p>
          </div>

          <div className="space-y-3">
            {result.tmdb_results.map((movie) => {
              // Check if this movie is the one already reviewed in DB
              const isReviewed = result.movie && result.movie.movie.tmdb_id === movie.tmdb_id;

              return (
                <div
                  key={movie.tmdb_id}
                  className={`group flex items-center gap-4 rounded-xl border p-4 transition-all ${isReviewed
                    ? "border-verdict-worth/40 bg-verdict-worth/5 hover:border-verdict-worth/60"
                    : "border-surface-elevated bg-surface-card hover:border-accent-gold/30 hover:bg-surface-elevated/50"
                    }`}
                >
                  {/* Mini Poster */}
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-elevated">
                    {movie.poster_url ? (
                      <Image
                        src={movie.poster_url}
                        alt={movie.title}
                        fill
                        className="object-cover"
                        sizes="60px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-2xl">🎬</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-text-primary truncate">{movie.title}</h3>
                      {isReviewed && (
                        <span className="shrink-0 rounded-full bg-verdict-worth/20 px-2 py-0.5 text-[10px] font-medium text-verdict-worth">
                          ✓ REVIEWED
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      {movie.release_date && (
                        <span>{new Date(movie.release_date).getFullYear()}</span>
                      )}
                      <span className="capitalize rounded-full bg-surface-elevated px-2 py-0.5">
                        {movie.media_type}
                      </span>
                      {movie.tmdb_vote_average && movie.tmdb_vote_average > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-accent-gold">★</span>
                          {movie.tmdb_vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {movie.overview && (
                      <p className="mt-2 text-xs text-text-muted line-clamp-2">
                        {movie.overview}
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  {isReviewed ? (
                    <Link
                      href={`/movie/${movie.tmdb_id}`}
                      className="shrink-0 rounded-lg bg-verdict-worth/15 px-4 py-2.5 text-sm font-medium text-verdict-worth transition-all hover:bg-verdict-worth/25 hover:scale-105"
                    >
                      View Review →
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleGenerate(movie)}
                      disabled={generating}
                      className="shrink-0 rounded-lg bg-accent-gold/10 px-4 py-2.5 text-sm font-medium text-accent-gold transition-all hover:bg-accent-gold/20 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {generating && selectedTmdbId === movie.tmdb_id ? (
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-gold border-t-transparent"></span>
                          Generating...
                        </span>
                      ) : (
                        "Generate Review"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && !generating && !generatedMovie && query && result?.tmdb_results?.length === 0 && (
        <div className="rounded-xl border border-surface-elevated bg-surface-card p-12 text-center">
          <p className="text-5xl mb-4">🔍</p>
          <h3 className="font-display text-lg text-text-primary mb-2">
            No results found
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            We couldn't find any movies or shows matching "{query}".
            Try checking your spelling or searching for a different title.
          </p>
        </div>
      )}
    </div>
  );
}
