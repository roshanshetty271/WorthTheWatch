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
  const slug = movie.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return (
    <Link href={`/movie/${movie.tmdb_id}`}>
      <div className="movie-card group cursor-pointer overflow-hidden rounded-xl bg-surface-card">
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

          {/* Verdict overlay */}
          {review && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
              <VerdictBadge verdict={review.verdict} size="sm" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <h3 className="font-display text-sm leading-tight text-text-primary line-clamp-2">
            {movie.title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
            {year && <span>{year}</span>}
            <span>•</span>
            <span className="capitalize">{movie.media_type}</span>
            {movie.tmdb_vote_average ? (
              <>
                <span>•</span>
                <span>⭐ {movie.tmdb_vote_average.toFixed(1)}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
