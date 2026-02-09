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
          {movie.tmdb_vote_average && movie.tmdb_vote_average > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-medium text-accent-gold backdrop-blur-md">
              ★ {movie.tmdb_vote_average.toFixed(1)}
            </span>
          )}
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
