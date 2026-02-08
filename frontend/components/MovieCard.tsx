"use client";

import Image from "next/image";
import Link from "next/link";
import VerdictBadge from "./VerdictBadge";
import type { MovieWithReview } from "@/lib/api";

interface MovieCardProps {
  data: MovieWithReview;
}

export default function MovieCard({ data }: MovieCardProps) {
  const { movie, review } = data;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : "";

  return (
    <Link href={`/movie/${movie.tmdb_id}`}>
      <div className="movie-card group cursor-pointer overflow-hidden rounded-xl border border-transparent bg-surface-card transition-all hover:border-accent-gold/20 hover:shadow-xl hover:shadow-accent-gold/5">
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
              <span className="text-4xl">🎬</span>
            </div>
          )}

          {/* Hover overlay with quick info */}
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="p-3">
              {review?.vibe && (
                <p className="mb-2 line-clamp-2 text-xs italic text-text-secondary">
                  "{review.vibe}"
                </p>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-accent-gold">
                View review
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>

          {/* Verdict badge - always visible */}
          {review && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 transition-opacity group-hover:opacity-0">
              <VerdictBadge verdict={review.verdict} size="sm" />
            </div>
          )}

          {/* Media type pill */}
          <div className="absolute right-2 top-2">
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/80 backdrop-blur-sm">
              {movie.media_type}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-display text-sm leading-tight text-text-primary line-clamp-2 group-hover:text-accent-gold transition-colors">
            {movie.title}
          </h3>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-text-muted">
            {year && <span>{year}</span>}
            {movie.tmdb_vote_average ? (
              <>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <span className="text-accent-gold">★</span>
                  {movie.tmdb_vote_average.toFixed(1)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
