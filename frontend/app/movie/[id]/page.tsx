import Image from "next/image";
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
      {/* Backdrop */}
      {movie.backdrop_url && (
        <div className="relative -mx-4 -mt-8 mb-8 h-64 overflow-hidden sm:-mx-6 sm:h-80 md:h-96">
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
              {year && <span>{year}</span>}
              {genres && (
                <>
                  <span className="text-text-muted">•</span>
                  <span>{genres}</span>
                </>
              )}
              {movie.media_type && (
                <>
                  <span className="text-text-muted">•</span>
                  <span className="capitalize">{movie.media_type}</span>
                </>
              )}
              {movie.tmdb_vote_average ? (
                <>
                  <span className="text-text-muted">•</span>
                  <span>⭐ {movie.tmdb_vote_average.toFixed(1)}</span>
                </>
              ) : null}
            </div>

            {movie.overview && (
              <p className="text-sm leading-relaxed text-text-secondary">
                {movie.overview}
              </p>
            )}
          </div>
        </div>

        {/* Review */}
        <div className="mt-10 rounded-2xl border border-surface-elevated bg-surface-card p-6 sm:p-8">
          <h2 className="mb-6 font-display text-xl text-accent-gold">
            The Internet&apos;s Verdict
          </h2>
          {review ? (
            <ReviewContent review={review} />
          ) : (
            <div className="py-8 text-center">
              <p className="text-text-secondary">
                No review generated yet for this title.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
