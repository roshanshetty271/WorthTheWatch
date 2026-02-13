"use client";

import Image from "next/image";
import Link from "next/link";
import type { MovieWithReview } from "@/lib/api";
import BookmarkButton from "./BookmarkButton";

interface MovieCardProps {
  data: MovieWithReview;
}

const VERDICT_STYLES: Record<string, {
  borderColor: string;
  glowColor: string;
  textColor: string;
  label: string;
  gradient: string;
  titleShadow: string;
}> = {
  "WORTH IT": {
    borderColor: "border-emerald-500/50",
    glowColor: "group-hover:shadow-emerald-500/20",
    textColor: "text-emerald-300",
    label: "Worth It",
    gradient: "from-emerald-500/20 to-transparent",
    titleShadow: "group-hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]"
  },
  "NOT WORTH IT": {
    borderColor: "border-rose-500/50",
    glowColor: "group-hover:shadow-rose-500/20",
    textColor: "text-rose-300",
    label: "Skip",
    gradient: "from-rose-500/20 to-transparent",
    titleShadow: "group-hover:drop-shadow-[0_0_8px_rgba(251,113,133,0.6)]"
  },
  "MIXED BAG": {
    borderColor: "border-amber-500/50",
    glowColor: "group-hover:shadow-amber-500/20",
    textColor: "text-amber-300",
    label: "Mixed",
    gradient: "from-amber-500/20 to-transparent",
    titleShadow: "group-hover:drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]"
  },
};

export default function MovieCard({ data }: MovieCardProps) {
  const { movie, review } = data;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";

  const verdictStyle = review
    ? VERDICT_STYLES[review.verdict] || VERDICT_STYLES["MIXED BAG"]
    : {
      borderColor: "border-white/10",
      glowColor: "group-hover:shadow-white/10",
      textColor: "text-white/80",
      label: "Unrated",
      gradient: "from-white/5 to-transparent",
      titleShadow: ""
    };

  // Get the best rating to show
  const rating = review?.imdb_score
    ? { value: review.imdb_score.toString(), label: "IMDb" }
    : (movie.tmdb_vote_average && movie.tmdb_vote_average > 0)
      ? { value: movie.tmdb_vote_average.toFixed(1), label: "TMDB" }
      : null;

  return (
    <Link href={`/movie/${movie.tmdb_id}`}>
      <div className={`
        group relative aspect-[2/3] w-full overflow-hidden rounded-2xl 
        bg-surface-card transition-all duration-500 ease-out ring-1 ring-white/10 shadow-2xl
        hover:-translate-y-2
      `}>

        {/* Poster Image */}
        <div className="absolute inset-0 z-0">
          {movie.poster_url ? (
            <Image
              src={movie.poster_url}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 140px, (max-width: 1024px) 170px, 200px"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              priority={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-4xl text-text-muted">🎬</span>
            </div>
          )}
        </div>

        {/* Overlays */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
        <div className={`absolute inset-0 z-10 bg-gradient-to-b ${verdictStyle.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100 mix-blend-overlay`} />

        {/* Top Row: Verdict (left) + Bookmark (right) */}
        <div className="absolute left-0 top-0 z-20 flex w-full justify-between items-start p-3">
          {/* Verdict Badge */}
          {verdictStyle && review ? (
            <span className={`
              inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 
              backdrop-blur-md transition-colors ${verdictStyle.borderColor}
            `}>
              <span className={`h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor] ${verdictStyle.textColor.replace('text-', 'bg-')}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${verdictStyle.textColor}`}>
                {verdictStyle.label}
              </span>
            </span>
          ) : (
            <span className="opacity-0" />
          )}

          {/* Bookmark — always visible */}
          <BookmarkButton
            tmdb_id={movie.tmdb_id}
            title={movie.title}
            poster_path={movie.poster_path || null}
            verdict={review?.verdict || null}
            variant="card"
            className="!relative !top-auto !right-auto"
          />
        </div>

        {/* Bottom Content */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4 transition-transform duration-300 bg-gradient-to-t from-black via-black/80 to-transparent">
          {/* Title */}
          <h3 className={`font-display text-base sm:text-lg font-bold leading-tight text-white transition-all duration-300 group-hover:text-white ${verdictStyle.titleShadow}`}>
            {movie.title}
          </h3>

          {/* Metadata Line: Year · Type · Rating */}
          <div className="mt-2 flex items-center gap-3 text-xs font-medium text-white/80">
            {year && <span>{year}</span>}
            {movie.media_type && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />
                <span className="capitalize">{movie.media_type}</span>
              </>
            )}
            {rating && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/40" aria-hidden="true" />
                <span className="flex items-center gap-1 text-yellow-500">
                  <span className="text-[10px]">⭐</span>
                  <span className="font-bold">{rating.value}</span>
                </span>
              </>
            )}
          </div>
        </div>

      </div>
    </Link>
  );
}