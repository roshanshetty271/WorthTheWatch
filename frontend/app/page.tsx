import Link from "next/link";
import Image from "next/image";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import VerdictBadge from "@/components/VerdictBadge";
import type { PaginatedMovies } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getMovies(): Promise<PaginatedMovies | null> {
  try {
    const res = await fetch(`${API_BASE}/api/movies?sort=latest&limit=50`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const data = await getMovies();
  const movies = data?.movies ?? [];

  // Get a featured movie (first one with a review and backdrop)
  const featured = movies.find((m) => m.review && m.movie.backdrop_url);
  const restMovies = movies.filter((m) => m !== featured);

  return (
    <div className="space-y-10">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Clean & Minimal
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="pt-4 text-center sm:pt-6">
        <h1 className="font-display text-4xl text-text-primary sm:text-5xl">
          Worth the Watch<span className="text-accent-gold">?</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-text-secondary">
          Should I stream this? The internet decides.
        </p>
        <div className="mx-auto mt-6 max-w-xl">
          <SearchBar placeholder="Search any movie or TV show..." size="lg" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURED SPOTLIGHT — Full-width cinematic card
          ═══════════════════════════════════════════════════════════════════ */}
      {featured && (
        <Link href={`/movie/${featured.movie.tmdb_id}`} className="block">
          <section className="group relative -mx-4 overflow-hidden sm:-mx-6 sm:rounded-2xl cursor-pointer">
            {/* Full Background Image */}
            <div className="absolute inset-0">
              <Image
                src={featured.movie.backdrop_url!}
                alt={featured.movie.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority
              />
              {/* Dark gradient overlay for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent" />
            </div>

            {/* Content positioned at bottom */}
            <div className="relative flex min-h-[320px] items-end p-6 sm:min-h-[380px] sm:p-8 lg:min-h-[420px]">
              <div className="max-w-xl space-y-3">
                {/* Featured label */}
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold"></span>
                  FEATURED
                </span>

                {/* Title */}
                <h2 className="font-display text-3xl leading-tight text-white sm:text-4xl lg:text-5xl">
                  {featured.movie.title}
                </h2>

                {/* Verdict */}
                {featured.review && (
                  <div className="flex flex-wrap items-center gap-3">
                    <VerdictBadge verdict={featured.review.verdict} size="lg" />
                    {featured.review.vibe && (
                      <p className="text-sm italic text-white/70">
                        "{featured.review.vibe}"
                      </p>
                    )}
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 pt-1 text-sm text-white/60">
                  {featured.movie.release_date && (
                    <span>{new Date(featured.movie.release_date).getFullYear()}</span>
                  )}
                  <span className="uppercase">{featured.movie.media_type}</span>
                  {featured.movie.tmdb_vote_average && (
                    <span>⭐ {featured.movie.tmdb_vote_average.toFixed(1)}</span>
                  )}
                </div>
              </div>

              {/* Arrow indicator */}
              <div className="absolute bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition-all group-hover:bg-accent-gold group-hover:text-surface sm:bottom-8 sm:right-8">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </section>
        </Link>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MORE VERDICTS — Movie Grid
          ═══════════════════════════════════════════════════════════════════ */}
      {restMovies.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl text-text-primary sm:text-2xl">
            More Verdicts
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {restMovies.map((item) => (
              <MovieCard key={item.movie.tmdb_id} data={item} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {movies.length === 0 && (
        <section className="rounded-2xl border border-surface-elevated bg-surface-card p-12 text-center">
          <p className="text-5xl">🎬</p>
          <h2 className="mt-4 font-display text-2xl text-text-primary">
            No reviews yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-text-secondary">
            Search for any movie or TV show to generate an AI-powered review!
          </p>
        </section>
      )}
    </div>
  );
}
