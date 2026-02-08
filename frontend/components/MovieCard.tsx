"use client";

import Image from "next/image";
import Link from "next/link";
import type { MovieWithReview } from "@/lib/api";

interface MovieCardProps {
  data: MovieWithReview;
}

// Clean verdict config - NO emojis, just elegant colors
const VERDICT_STYLES: Record<string, {
  dotColor: string;
  bgColor: string;
  textColor: string;
  label: string;
}> = {
  "WORTH IT": {
    dotColor: "bg-emerald-400",
    bgColor: "bg-emerald-500/20",
    textColor: "text-emerald-400",
    label: "Worth It"
  },
  "NOT WORTH IT": {
    dotColor: "bg-rose-400",
    bgColor: "bg-rose-500/20",
    textColor: "text-rose-400",
    label: "Skip"
  },
  "MIXED BAG": {
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-500/20",
    textColor: "text-amber-400",
    label: "Mixed"
  },
};

export default function MovieCard({ data }: MovieCardProps) {
  const { movie, review } = data;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";
  const verdictStyle = review ? VERDICT_STYLES[review.verdict] || VERDICT_STYLES["MIXED BAG"] : null;

  return (
    <Link href={`/movie/${movie.tmdb_id}`}>
      <div className="movie-card group cursor-pointer overflow-hidden rounded-xl bg-surface-card border border-white/5 transition-all duration-300 hover:border-white/15 hover:bg-surface-elevated">
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden">
          {movie.poster_url ? (
            <Image
              src={movie.poster_url}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-4xl text-text-muted">🎬</span>
            </div>
          )}

          {/* Always visible gradient at bottom - helps with any poster color */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />

          {/* Media type pill - top right */}
          <div className="absolute right-2 top-2">
            <span className="rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70 backdrop-blur-sm">
              {movie.media_type}
            </span>
          </div>

          {/* TMDB Score - top left (only if 7+) */}
          {movie.tmdb_vote_average && movie.tmdb_vote_average >= 7 && (
            <div className="absolute left-2 top-2">
              <span className="flex items-center gap-0.5 rounded bg-black/50 px-1.5 py-0.5 text-xs font-medium text-accent-gold backdrop-blur-sm">
                ★ {movie.tmdb_vote_average.toFixed(1)}
              </span>
            </div>
          )}

          {/* Verdict + View Review - always visible at bottom */}
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="flex items-center justify-between">
              {/* Verdict pill - clean, minimal */}
              {review && verdictStyle && (
                <span className={`
                  inline-flex items-center gap-1.5 rounded-full px-2.5 py-1
                  ${verdictStyle.bgColor} backdrop-blur-sm
                `}>
                  <span className={`h-1.5 w-1.5 rounded-full ${verdictStyle.dotColor}`} />
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${verdictStyle.textColor}`}>
                    {verdictStyle.label}
                  </span>
                </span>
              )}

              {/* View indicator - always visible */}
              <span className="flex items-center gap-1 text-[11px] font-medium text-white/60 transition-colors group-hover:text-white">
                View
                <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="p-3">
          <h3 className="font-display text-sm leading-tight text-text-primary line-clamp-2 group-hover:text-white transition-colors">
            {movie.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            {year && <span>{year}</span>}
            {movie.tmdb_vote_average && movie.tmdb_vote_average < 7 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <span className="text-accent-gold">★</span>
                  {movie.tmdb_vote_average.toFixed(1)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
