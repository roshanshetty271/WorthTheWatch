import Link from "next/link";
import Image from "next/image";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import MoodSection from "@/components/MoodSection";
import VerdictBadge from "@/components/VerdictBadge";
import type { PaginatedMovies, MovieWithReview } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Section Configuration ─────────────────────────────────────
const SECTIONS = [
  { id: "latest", title: "Latest Reviews" },
  { id: "worth-it", title: "Certified Worth It" },
  { id: "trending", title: "Trending Now" },
  { id: "hidden-gems", title: "Hidden Gems" },
  { id: "skip-these", title: "Skip These" },
  { id: "tv-shows", title: "Binge-Worthy TV" },
  { id: "mixed-bag", title: "The Internet Is Divided" },
];

// ─── Data Fetching ─────────────────────────────────────────────
async function getSectionMovies(category: string): Promise<MovieWithReview[]> {
  try {
    const res = await fetch(
      `${API_BASE}/api/movies?category=${category}&limit=8`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data: PaginatedMovies = await res.json();
    return data.movies || [];
  } catch {
    return [];
  }
}

async function getFeaturedMovie(): Promise<MovieWithReview | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/movies?category=latest&limit=1`,
      { next: { revalidate: 0 } }
    );
    if (!res.ok) return null;
    const data: PaginatedMovies = await res.json();
    const movie = data.movies?.[0];
    return movie?.movie.backdrop_url ? movie : null;
  } catch {
    return null;
  }
}

// ─── Horizontal Section Component ──────────────────────────────
function HorizontalSection({
  id,
  title,
  movies,
}: {
  id: string;
  title: string;
  movies: MovieWithReview[];
}) {
  if (movies.length === 0) return null;

  return (
    <section className="py-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-6 px-4 sm:px-0">
        <div className="border-l-4 border-accent-gold pl-3 sm:pl-4">
          <h2 className="font-body text-xl sm:text-2xl font-bold tracking-wide text-white uppercase">
            {title}
          </h2>
        </div>
        <Link
          href={`/browse/${id}`}
          className="group flex items-center gap-2 mb-1"
        >
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white/50 group-hover:text-accent-gold transition-colors">
            View All
          </span>
          <div className="flex bg-white/5 p-1.5 rounded-full group-hover:bg-accent-gold/20 transition-colors">
            <svg className="h-3 w-3 text-white/50 group-hover:text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Horizontal Scroll */}
      <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scroll-pl-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {movies.map((item) => (
          <div
            key={item.movie.tmdb_id}
            className="snap-start shrink-0 w-[140px] sm:w-[170px] md:w-[200px]"
          >
            <MovieCard data={item} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Page Component ────────────────────────────────────────────
export default async function HomePage() {
  // Fetch all sections in parallel
  const [featured, ...sectionResults] = await Promise.all([
    getFeaturedMovie(),
    ...SECTIONS.map((s) => getSectionMovies(s.id)),
  ]);

  // Pair sections with their data
  const sectionsWithData = SECTIONS.map((section, i) => ({
    ...section,
    movies: sectionResults[i] || [],
  }));

  // Check if any section has data
  const hasAnySections = sectionsWithData.some((s) => s.movies.length > 0);

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Full Screen & Immersive
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center">
        {/* Background Image */}
        {featured ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            <Image
              src={featured.movie.backdrop_url!}
              alt={featured.movie.title}
              fill
              sizes="100vw"
              className="object-cover object-top transition-transform duration-[20s] hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-surface to-surface" />
        )}

        {/* Center Content */}
        <div className="relative z-30 w-full max-w-4xl px-4 text-center pt-32 mb-32 sm:mb-40">
          <h1 className="mb-4 font-bold text-3xl text-white sm:text-5xl md:text-6xl tracking-tight drop-shadow-xl">
            Stop scrolling. <br className="hidden sm:block" />
            <span className="text-accent-gold">Start watching.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-lg text-base sm:text-xl text-white/80 font-medium drop-shadow-md">
            Cut through the noise with AI-powered verdicts.
          </p>
          <div className="mx-auto max-w-xl sm:max-w-2xl mb-12">
            <SearchBar placeholder="Search any movie or TV show..." size="lg" />
          </div>
        </div>

        {/* Bottom Left: Featured Movie Info */}
        {featured && (
          <div className="absolute bottom-0 left-0 z-20 w-full p-6 sm:p-12 pointer-events-none">
            <div className="mx-auto flex max-w-7xl items-end justify-between pointer-events-auto">
              <div className="max-w-2xl">
                <div className="mb-2 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold"></span>
                    LATEST
                  </span>
                  {featured.review && (
                    <VerdictBadge verdict={featured.review.verdict} size="sm" />
                  )}
                </div>
                <Link href={`/movie/${featured.movie.tmdb_id}`} className="group block">
                  <h2 className="font-display text-3xl text-white drop-shadow-lg transition-colors group-hover:text-accent-gold sm:text-4xl">
                    {featured.movie.title}
                  </h2>
                </Link>
                {featured.review?.vibe && (
                  <p className="mt-1 max-w-lg text-sm italic text-white/80 drop-shadow-md">
                    &ldquo;{featured.review.vibe}&rdquo;
                  </p>
                )}
                <Link
                  href={`/movie/${featured.movie.tmdb_id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-gold px-5 py-2.5 text-sm font-semibold text-black transition-all hover:bg-accent-gold/90 hover:shadow-lg hover:shadow-accent-gold/30"
                >
                  Read Full Review
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ALL SECTIONS — Inside one single container for consistent alignment
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        {hasAnySections ? (
          <div className="space-y-2">
            {/* Mood Section — FIRST, same container as everything else */}
            <MoodSection />

            {/* Movie Sections */}
            {sectionsWithData.map((section) => (
              <HorizontalSection
                key={section.id}
                id={section.id}
                title={section.title}
                movies={section.movies}
              />
            ))}
          </div>
        ) : (
          <section className="mx-4 rounded-2xl border border-surface-elevated bg-surface-card p-12 text-center">
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