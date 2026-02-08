import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewContent from "@/components/ReviewContent";
import TrailerEmbed from "@/components/TrailerEmbed";
import VerdictBadge from "@/components/VerdictBadge";
import type { MovieWithReview } from "@/lib/api";
import type { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  params: { id: string };
}

async function getMovie(tmdbId: string): Promise<MovieWithReview | null> {
  try {
    const res = await fetch(`${API_BASE}/api/movies/${tmdbId}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getMovie(params.id);
  if (!data) return { title: "Not Found | Worth the Watch?" };

  const verdict = data.review?.verdict || "";
  return {
    title: `Is ${data.movie.title} Worth Watching? | Worth the Watch`,
    description: data.review?.review_text?.slice(0, 155) || data.movie.overview?.slice(0, 155),
    openGraph: {
      title: `${data.movie.title}: ${verdict} | Worth the Watch?`,
      description: data.review?.review_text?.slice(0, 155),
      images: data.movie.backdrop_url ? [data.movie.backdrop_url] : [],
    },
  };
}

export default async function MoviePage({ params }: Props) {
  const data = await getMovie(params.id);
  if (!data) notFound();

  const { movie, review } = data;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";
  const genres = movie.genres
    ?.map((g) => g.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="animate-slide-up">
      {/* ═══════════════════════════════════════════════════════════════════
          FULLSCREEN HERO BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        {/* Background Image */}
        {movie.backdrop_url ? (
          <div className="absolute inset-0 z-0">
            <Image
              src={movie.backdrop_url}
              alt={movie.title}
              fill
              className="object-cover object-top"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-surface-elevated to-surface" />
        )}

        {/* Back Button - Floating top left */}
        <div className="absolute top-20 left-4 z-30 sm:left-6">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm text-white/90 transition-all hover:bg-black/60 hover:text-white"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Movie Info Overlay */}
        <div className="relative z-20 w-full px-4 pb-8 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
              {/* Poster */}
              {movie.poster_url && (
                <div className="relative mx-auto h-64 w-44 shrink-0 overflow-hidden rounded-xl shadow-2xl sm:mx-0 sm:h-72 sm:w-48 border-2 border-white/10">
                  <Image
                    src={movie.poster_url}
                    alt={movie.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 space-y-3 text-center sm:text-left">
                <h1 className="font-display text-3xl text-white drop-shadow-lg sm:text-4xl md:text-5xl">
                  {movie.title}
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
                  {year && <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-white/90">{year}</span>}
                  {genres && (
                    <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-white/90">{genres}</span>
                  )}
                  {movie.media_type && (
                    <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 capitalize text-white/90">
                      {movie.media_type}
                    </span>
                  )}
                  {movie.tmdb_vote_average ? (
                    <span className="rounded-full bg-accent-gold/20 backdrop-blur-sm px-3 py-1 text-accent-gold font-medium">
                      ⭐ {movie.tmdb_vote_average.toFixed(1)}
                    </span>
                  ) : null}
                </div>

                {/* Verdict Badge */}
                {review && (
                  <div className="pt-2">
                    <VerdictBadge verdict={review.verdict} size="lg" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Movie Overview */}
        {movie.overview && (
          <div className="mb-6 rounded-xl bg-surface-card border border-surface-elevated p-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              {movie.overview}
            </p>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            TRAILER (Prominent Position - Right After Header)
            ═══════════════════════════════════════════════════════════════════ */}
        {review?.trailer_url && (
          <div className="mt-8 rounded-2xl border border-surface-elevated bg-surface-card p-4 sm:p-6">
            <h2 className="mb-4 font-display text-xl text-accent-gold flex items-center gap-2">
              <span>🎬</span> Watch Trailer
            </h2>
            <TrailerEmbed youtubeUrl={review.trailer_url} />
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            THE INTERNET'S VERDICT
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-10 rounded-2xl border border-surface-elevated bg-surface-card p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-xl text-accent-gold">
              The Internet&apos;s Verdict
            </h2>
            {review?.sources_count && (
              <span className="text-xs text-text-muted">
                📰 Based on {review.sources_count} sources
              </span>
            )}
          </div>
          {review ? (
            <ReviewContent review={review} />
          ) : (
            <div className="py-8 text-center">
              <p className="text-text-secondary">
                No review generated yet for this title.
              </p>
              <Link
                href={`/search?q=${encodeURIComponent(movie.title)}`}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent-gold/10 px-5 py-2.5 text-sm text-accent-gold transition-colors hover:bg-accent-gold/20"
              >
                Generate a review →
              </Link>
            </div>
          )}
        </div>



        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM NAVIGATION
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="mt-8 flex items-center justify-between border-t border-surface-elevated pt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent-gold"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent-gold"
          >
            Search another title
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
