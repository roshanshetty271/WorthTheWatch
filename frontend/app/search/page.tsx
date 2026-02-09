"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { searchMovies, type SearchResult } from "@/lib/api";

// Wrap in Suspense because useSearchParams requires it in Next.js 14+
export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl space-y-8 px-4">
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
  const [error, setError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const data = await searchMovies(q);
      setResult(data);
    } catch (e) {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) doSearch(query);
  }, [query, doSearch]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pt-24 sm:px-6">
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

      {/* Results Grid */}
      {!loading && result?.tmdb_results && result.tmdb_results.length > 0 && (
        <div className="space-y-6">
          <h2 className="font-display text-xl text-text-primary">
            Found {result.tmdb_results.length} Titles
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {result.tmdb_results.map((movie) => {
              // Check if we have a review for this movie in our DB
              // The API returns 'movie' if there's an exact DB match, but we want to check
              // if any of the TMDB results match the DB record.
              // Note: The main search API doesn't currently return a list of ALL reviewed IDs,
              // but we can infer if the main DB match equals this one.
              // For a perfect "reviewed" badge on all items, we'd need the API to return that info
              // for each result, similar to the quick search. 
              // For now, let's just show the cards.

              const year = movie.release_date
                ? new Date(movie.release_date).getFullYear()
                : "";

              const posterUrl = movie.poster_url || (movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : null);

              return (
                <Link
                  href={`/movie/${movie.tmdb_id}`}
                  key={movie.tmdb_id}
                  className="group relative flex flex-col overflow-hidden rounded-xl bg-surface-card border border-surface-elevated transition-all hover:scale-105 hover:shadow-xl hover:border-accent-gold/30 hover:z-10"
                >
                  {/* Poster Aspect Ratio 2:3 */}
                  <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-elevated">
                    {posterUrl ? (
                      <Image
                        src={posterUrl}
                        alt={movie.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-4xl opacity-20">🎬</span>
                      </div>
                    )}

                    {/* Media Type Badge */}
                    <div className="absolute top-2 right-2 rounded-md bg-black/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-white uppercase tracking-wide">
                      {movie.media_type}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-1 flex-col p-3">
                    <h3 className="line-clamp-1 font-medium text-text-primary group-hover:text-accent-gold transition-colors">
                      {movie.title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                      <span>{year}</span>
                      {movie.tmdb_vote_average && movie.tmdb_vote_average > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="text-accent-gold">★</span>
                          {movie.tmdb_vote_average.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && !error && query && result?.tmdb_results?.length === 0 && (
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
