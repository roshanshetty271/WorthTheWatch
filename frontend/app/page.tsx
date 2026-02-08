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
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Full Screen & Immersive
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden">
        {/* Background Image */}
        {featured ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={featured.movie.backdrop_url!}
              alt={featured.movie.title}
              fill
              className="object-cover transition-transform duration-[20s] hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-surface/30" />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-surface" />
        )}

        {/* Center Content: Title & Search */}
        <div className="relative z-30 w-full max-w-2xl px-4 text-center">
          <h1 className="mb-2 font-display text-5xl text-white shadow-black drop-shadow-lg sm:text-6xl md:text-7xl">
            Worth the Watch<span className="text-accent-gold">?</span>
          </h1>
          <p className="mx-auto mb-8 max-w-md text-lg text-white/90 shadow-black drop-shadow-md">
            Should I stream this? The internet decides.
          </p>
          <div className="mx-auto max-w-xl shadow-2xl">
            <SearchBar placeholder="Search any movie or TV show..." size="lg" />
          </div>
        </div>

        {/* Bottom Left: Featured Movie Info */}
        {featured && (
          <div className="absolute bottom-0 left-0 z-20 w-full p-6 sm:p-12 pointer-events-none">
            <div className="mx-auto flex max-w-7xl items-end justify-between pointer-events-auto">
              <div className="max-w-2xl">
                <Link href={`/movie/${featured.movie.tmdb_id}`} className="group block">
                  <div className="mb-2 flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold"></span>
                      FEATURED
                    </span>
                    {featured.review && (
                      <VerdictBadge verdict={featured.review.verdict} size="sm" />
                    )}
                  </div>
                  <h2 className="font-display text-3xl text-white drop-shadow-lg transition-colors group-hover:text-accent-gold sm:text-4xl">
                    {featured.movie.title}
                  </h2>
                  {featured.review?.vibe && (
                    <p className="mt-1 max-w-lg text-sm italic text-white/80 drop-shadow-md">
                      "{featured.review.vibe}"
                    </p>
                  )}
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          MORE VERDICTS — Movie Grid
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        {restMovies.length > 0 && (
          <section>
            <h2 className="mb-6 font-display text-2xl text-text-primary sm:text-3xl">
              More Verdicts
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
    </div>
  );
}
