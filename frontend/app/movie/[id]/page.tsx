import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewContent from "@/components/ReviewContent";
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
          BACK NAVIGATION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mb-6">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-full border border-surface-elevated bg-surface-card px-4 py-2 text-sm text-text-secondary transition-all hover:border-accent-gold/30 hover:text-accent-gold"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to all reviews
        </Link>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
      {movie.backdrop_url && (
        <div className="relative -mx-4 mb-8 h-64 overflow-hidden rounded-2xl sm:-mx-6 sm:h-80 md:h-96">
          <Image
            src={movie.backdrop_url}
            alt={movie.title}
            fill
            className="object-cover"
            priority
          />
          <div className="gradient-bottom absolute inset-0" />
          <div className="gradient-top absolute inset-0" />
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        {/* ═══════════════════════════════════════════════════════════════════
            MOVIE HEADER
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-8 sm:flex-row">
          {/* Poster */}
          {movie.poster_url && (
            <div className="relative mx-auto h-72 w-48 shrink-0 overflow-hidden rounded-xl shadow-2xl sm:mx-0 sm:h-80 sm:w-52">
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
          <div className="flex-1 space-y-4">
            <h1 className="font-display text-3xl text-text-primary sm:text-4xl">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
              {year && <span className="rounded-full bg-surface-elevated px-3 py-1">{year}</span>}
              {genres && (
                <span className="rounded-full bg-surface-elevated px-3 py-1">{genres}</span>
              )}
              {movie.media_type && (
                <span className="rounded-full bg-surface-elevated px-3 py-1 capitalize">
                  {movie.media_type}
                </span>
              )}
              {movie.tmdb_vote_average ? (
                <span className="rounded-full bg-accent-gold/10 px-3 py-1 text-accent-gold">
                  ⭐ {movie.tmdb_vote_average.toFixed(1)} TMDB
                </span>
              ) : null}
            </div>

            {movie.overview && (
              <p className="text-sm leading-relaxed text-text-secondary">
                {movie.overview}
              </p>
            )}

            {/* Quick verdict preview for mobile */}
            {review && (
              <div className="sm:hidden">
                <div
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${review.verdict === "WORTH IT"
                      ? "bg-verdict-worth/15 text-verdict-worth"
                      : review.verdict === "NOT WORTH IT"
                        ? "bg-verdict-skip/15 text-verdict-skip"
                        : "bg-verdict-mixed/15 text-verdict-mixed"
                    }`}
                >
                  {review.verdict === "WORTH IT" && "✅"}
                  {review.verdict === "NOT WORTH IT" && "❌"}
                  {review.verdict === "MIXED BAG" && "⚖️"}
                  {review.verdict}
                </div>
              </div>
            )}
          </div>
        </div>

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
