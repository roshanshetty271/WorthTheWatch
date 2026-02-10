"use client";

import Image from "next/image";
import Link from "next/link";
import type { MovieWithReview } from "@/lib/api";

interface MovieCardProps {
  data: MovieWithReview;
}

// Verdict Styles - keeping consistency visuals but making them pop more
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

  // Default style if no review yet
  const verdictStyle = review
    ? VERDICT_STYLES[review.verdict] || VERDICT_STYLES["MIXED BAG"]
    : {
      borderColor: "border-white/10",
      glowColor: "group-hover:shadow-white/10",
      textColor: "text-white/70",
      label: "Unrated",
      gradient: "from-white/5 to-transparent",
      titleShadow: ""
    };

  return (
    <Link href={`/movie/${movie.tmdb_id}`}>
      {/* 
        Card Container 
        - 3D Hover Lift
        - Glow effect based on verdict
        - Full rounded corners
      */}
      <div className={`
        group relative aspect-[2/3] w-full overflow-hidden rounded-2xl 
        bg-surface-card transition-all duration-500 ease-out
        hover:-translate-y-2 hover:shadow-2xl ${verdictStyle.glowColor}
      `}>

        {/* Poster Image - Full Bleed */}
        <div className="absolute inset-0 z-0">
          {movie.poster_url ? (
            <Image
              src={movie.poster_url}
              alt={movie.title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              priority={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-surface-elevated">
              <span className="text-4xl text-text-muted">🎬</span>
            </div>
          )}
        </div>

        {/* 
          Overlays 
          - Gradient for readability (Stronger at bottom for white posters)
          - Colored tint based on verdict (very subtle)
        */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90 transition-opacity duration-300 group-hover:opacity-100" />
        <div className={`absolute inset-0 z-10 bg-gradient-to-b ${verdictStyle.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-100 mix-blend-soft-light`} />

        {/* 
          Top Glass Bar 
          - Floating Rating Badge
        */}
        <div className="absolute left-0 top-0 z-20 flex w-full justify-between p-3">
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
            <span className="opacity-0" /> // Spacer
          )}

          {/* Rating Badge - TMDB Only */}
          {/* Rating Badge - IMDb Preferred > TMDB */}
          {(review?.imdb_score ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-bold text-yellow-400 backdrop-blur-md shadow-sm">
              <span className="text-[10px]">⭐</span>
              <span>{review.imdb_score}</span>
            </span>
          ) : (movie.tmdb_vote_average && movie.tmdb_vote_average > 0) ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-medium text-accent-gold backdrop-blur-md" title="TMDB Rating">
              {/* Simple TMDB Logo SVG */}
              <svg className="h-3 w-auto" viewBox="0 0 270 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M26.8 1.4C26.8 0.6 26.2 0 25.4 0H1.4C0.6 0 0 0.6 0 1.4V18.6C0 19.4 0.6 20 1.4 20H25.4C26.2 20 26.8 19.4 26.8 18.6V1.4ZM11.6 15.6H9.2V6.4H4.8V4.4H16V6.4H11.6V15.6ZM22.4 15.6H20L17.2 7.6L14.4 15.6H12L15.6 4.4H18.8L22.4 15.6ZM42.8 1.4C42.8 0.6 42.2 0 41.4 0H29.4C28.6 0 28 0.6 28 1.4V18.6C28 19.4 28.6 20 29.4 20H41.4C42.2 20 42.8 19.4 42.8 18.6V1.4ZM38 15.6H35.6V7.6L33.6 13.6H32L30 7.6V15.6H27.6V4.4H31.2L32.8 9.6L34.4 4.4H38V15.6ZM56.8 1.4C56.8 0.6 56.2 0 55.4 0H45.4C44.6 0 44 0.6 44 1.4V18.6C44 19.4 44.6 20 45.4 20H55.4C56.2 20 56.8 19.4 56.8 18.6V1.4ZM51.6 15.6H46.4V4.4H51.6C53.6 4.4 54.4 5.6 54.4 7.6V12.4C54.4 14.4 53.6 15.6 51.6 15.6ZM51.8 13V6.8C51.8 6.4 51.6 6.2 51.2 6.2H48.8V13.6H51.2C51.6 13.6 51.8 13.4 51.8 13ZM70.8 1.4C70.8 0.6 70.2 0 69.4 0H59.4C58.6 0 58 0.6 58 1.4V18.6C58 19.4 58.6 20 59.4 20H69.4C70.2 20 70.8 19.4 70.8 18.6V1.4ZM65.6 13.2C66.8 12.8 67.4 12 67.4 10.8V7.2C67.4 5.6 66.4 4.4 64.6 4.4H60.4V15.6H64.8C66.8 15.6 67.8 14.8 67.8 13.2V13.2H65.6ZM64.8 13.6H62.8V10.8H64.8C65.2 10.8 65.4 11 65.4 11.4V13C65.4 13.4 65.2 13.6 64.8 13.6ZM64.6 9H62.8V6.4H64.6C65 6.4 65.2 6.6 65.2 7V8.4C65.2 8.8 65 9 64.6 9Z" />
              </svg>
              <span>{movie.tmdb_vote_average.toFixed(1)}</span>
            </span>
          ) : null)}
        </div>

        {/* 
          Bottom Glass Content
          - Title with Dynamic Shadow
          - Metadata
        */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4 transition-transform duration-300 bg-gradient-to-t from-black via-black/80 to-transparent">
          {/* Title */}
          <h3 className={`font-display text-base sm:text-lg font-bold leading-tight text-white transition-all duration-300 group-hover:text-white ${verdictStyle.titleShadow}`}>
            {movie.title}
          </h3>

          {/* Metadata Line */}
          <div className="mt-2 flex items-center gap-3 text-xs font-medium text-white/70">
            {year && <span>{year}</span>}
            {movie.media_type && (
              <>
                <span className="h-1 w-1 rounded-full bg-white/30" />
                <span className="capitalize">{movie.media_type}</span>
              </>
            )}
          </div>


        </div>

      </div>
    </Link>
  );
}
