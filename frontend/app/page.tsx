import Link from "next/link";
import Image from "next/image";
import SearchBar from "@/components/SearchBar";
import MovieCard from "@/components/MovieCard";
import VerdictBadge from "@/components/VerdictBadge";
import type { PaginatedMovies, MovieWithReview } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Section Configuration ─────────────────────────────────────
const SECTIONS = [
  { id: "latest", title: "Latest Reviews", emoji: "🆕" },
  { id: "worth-it", title: "Certified Worth It", emoji: "✅" },
  { id: "trending", title: "Trending Now", emoji: "🔥" },
  { id: "hidden-gems", title: "Hidden Gems", emoji: "💎" },
  { id: "skip-these", title: "Skip These", emoji: "❌" },
  { id: "tv-shows", title: "Binge-Worthy TV", emoji: "📺" },
  { id: "mixed-bag", title: "The Internet Is Divided", emoji: "⚖️" },
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
  emoji,
  movies,
}: {
  id: string;
  title: string;
  emoji: string;
  movies: MovieWithReview[];
}) {
  if (movies.length === 0) return null;

  return (
    <section className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 sm:px-0">
        <h2 className="font-display text-xl text-text-primary flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h2>
        <Link
          href={`/browse/${id}`}
          className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors flex items-center gap-1"
        >
          View All
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {movies.map((item) => (
          <div
            key={item.movie.tmdb_id}
            className="snap-start shrink-0 w-[150px] sm:w-[160px] md:w-[180px]"
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
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
        {/* Background Image */}
        {featured ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={featured.movie.backdrop_url!}
              alt={featured.movie.title}
              fill
              className="object-cover object-top transition-transform duration-[20s] hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-black via-surface to-surface" />
        )}

        {/* Center Content: Title & Search */}
        <div className="relative z-30 w-full max-w-2xl px-4 text-center">
          <h1 className="mb-2 font-display text-3xl text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
            Worth the Watch<span className="text-accent-gold">?</span>
          </h1>
          <p className="mx-auto mb-6 sm:mb-8 max-w-xs sm:max-w-md text-sm sm:text-base md:text-lg text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
            Should I stream this? The internet decides.
          </p>
          <div className="mx-auto max-w-xl">
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
                    "{featured.review.vibe}"
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
          NETFLIX-STYLE SECTIONS — Horizontal Scroll
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mx-auto max-w-7xl py-8 sm:px-6">
        {hasAnySections ? (
          <div className="space-y-2">
            {sectionsWithData.map((section) => (
              <HorizontalSection
                key={section.id}
                id={section.id}
                title={section.title}
                emoji={section.emoji}
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
