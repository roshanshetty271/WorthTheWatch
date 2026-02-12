"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReviewSection from "@/components/ReviewSection";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import BookmarkButton from "@/components/BookmarkButton";
import type { MovieWithReview, Review } from "@/lib/api";

interface MoviePageContentProps {
    movieData: MovieWithReview;
}

export default function MoviePageContent({ movieData }: MoviePageContentProps) {
    const { movie, review: initialReview } = movieData;
    const [review, setReview] = useState<Review | null>(initialReview);
    const router = useRouter();

    const [backdropSrc, setBackdropSrc] = useState<string | null>(movie.backdrop_url || movie.poster_url || null);
    const [isPosterFallback, setIsPosterFallback] = useState<boolean>(!movie.backdrop_url && !!movie.poster_url);

    const handleImageError = () => {
        if (backdropSrc === movie.backdrop_url && movie.poster_url) {
            setBackdropSrc(movie.poster_url);
            setIsPosterFallback(true);
        } else {
            setBackdropSrc(null);
        }
    };

    const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : "";
    const genres = movie.genres
        ?.map((g) => g.name)
        .filter(Boolean)
        .join(", ");

    return (
        <div className="animate-slide-up">
            {/* ═══════════════════════════════════════════════════════════════════
          FULLSCREEN HERO BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-[55vh] md:min-h-[70vh] flex flex-col justify-between overflow-hidden">
                {/* Background Image Logic */}
                <div className="absolute inset-0 z-0">
                    {backdropSrc ? (
                        <>
                            <Image
                                src={backdropSrc}
                                alt={movie.title}
                                fill
                                className={`object-cover ${isPosterFallback ? "object-center opacity-60" : "object-top"}`}
                                priority
                                onError={handleImageError}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
                            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
                            {isPosterFallback && <div className="absolute inset-0 bg-black/40" />}
                        </>
                    ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-b from-surface-elevated to-surface" />
                    )}
                </div>

                {/* Back Button — uses router.back() to respect browser history */}
                <div className="relative z-30 pt-24 px-6">
                    <div className="mx-auto max-w-7xl">
                        <button
                            onClick={() => router.back()}
                            className="group inline-flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 transition-all hover:bg-black/60 hover:text-white hover:scale-110"
                            aria-label="Go back"
                        >
                            <svg
                                className="h-6 w-6 transition-transform group-hover:-translate-x-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Movie Info Overlay */}
                <div className="relative z-20 w-full px-4 pb-8 sm:px-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-8">
                            {/* Poster */}
                            {movie.poster_url && (
                                <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-xl shadow-2xl md:mx-0 md:h-72 md:w-52 border-2 border-white/10">
                                    <Image
                                        src={movie.poster_url}
                                        alt={movie.title}
                                        fill
                                        className="object-cover"
                                        priority
                                        onError={(e) => {
                                            const target = e.target as HTMLImageElement;
                                            target.style.display = "none";
                                            target.parentElement!.style.display = "none";
                                        }}
                                    />
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 space-y-3 text-center md:text-left">
                                <h1 className="font-display text-2xl text-white drop-shadow-lg md:text-5xl">
                                    {movie.title}
                                </h1>

                                {/* Rating - IMDb Preferred */}
                                <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium text-white/90 md:justify-start">
                                    {(review?.imdb_score ? (
                                        <span className="flex items-center gap-1.5 rounded-full bg-yellow-400/20 md:bg-black/40 md:backdrop-blur-md px-3 py-1 text-yellow-300 ring-1 ring-yellow-400/50">
                                            <span className="text-lg">⭐</span> <span className="font-bold text-white">{review.imdb_score}</span> <span className="text-xs opacity-70">IMDb</span>
                                        </span>
                                    ) : (movie.tmdb_vote_average && movie.tmdb_vote_average > 0) ? (
                                        <span className="flex items-center gap-1.5 rounded-full bg-accent-gold/20 md:bg-black/40 md:backdrop-blur-md px-3 py-1 text-accent-gold ring-1 ring-accent-gold/50">
                                            <span className="text-lg">★</span> <span>{movie.tmdb_vote_average.toFixed(1)}</span> <span className="text-xs opacity-70">TMDB</span>
                                        </span>
                                    ) : null)}

                                    {year && (
                                        <span className="flex items-center gap-1.5 opacity-80">
                                            <span className="text-base">📅</span> {year}
                                        </span>
                                    )}
                                    {movie.runtime && (
                                        <span className="flex items-center gap-1.5 opacity-80">
                                            <span className="text-base">⏱️</span> {movie.runtime} min
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm md:justify-start">
                                    {genres && (
                                        <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-white/90">
                                            {genres}
                                        </span>
                                    )}
                                    {movie.media_type && (
                                        <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 capitalize text-white/90">
                                            {movie.media_type}
                                        </span>
                                    )}
                                </div>

                                {/* Verdict Badge + Save Button */}
                                {review && (
                                    <div className="pt-2 flex items-center justify-center gap-3 md:justify-start">
                                        <VerdictBadge verdict={review.verdict} size="lg" />
                                        <BookmarkButton
                                            tmdb_id={movie.tmdb_id}
                                            title={movie.title}
                                            poster_path={movie.poster_path || null}
                                            verdict={review.verdict}
                                            variant="page"
                                        />
                                    </div>
                                )}

                                {/* Where to Watch */}
                                {review && (
                                    <div className="pt-3 animate-fade-in flex flex-wrap justify-center md:justify-start">
                                        <StreamingAvailability tmdbId={movie.tmdb_id} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
            SCORES & OVERVIEW
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">

                {/* Score Badges */}
                <div className="mb-6 flex flex-wrap gap-3 animate-fade-in-delayed">
                    {review?.imdb_score ? (
                        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg font-bold text-yellow-500">IMDb</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-yellow-500/80 uppercase tracking-wider">Rating</span>
                                <span className="font-bold text-white">{review.imdb_score}</span>
                            </div>
                        </div>
                    ) : movie.tmdb_vote_average ? (
                        <div className="flex items-center gap-2 rounded-lg border border-accent-gold/20 bg-accent-gold/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">⭐</span>
                            <div className="flex flex-col leading-none justify-center">
                                <span className="font-bold text-white text-lg">{movie.tmdb_vote_average.toFixed(1)}</span>
                            </div>
                        </div>
                    ) : null}

                    {review?.rt_critic_score ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">🍅</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Critics</span>
                                <span className="font-bold text-white">{review.rt_critic_score}%</span>
                            </div>
                        </div>
                    ) : null}

                    {review?.rt_audience_score ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">🍿</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Audience</span>
                                <span className="font-bold text-white">{review.rt_audience_score}%</span>
                            </div>
                        </div>
                    ) : null}

                    {review?.metascore ? (
                        <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-500 font-bold text-white text-xs">
                                {review.metascore}
                            </div>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Metascore</span>
                                <span className="font-bold text-white">{review.metascore}</span>
                            </div>
                        </div>
                    ) : null}
                </div>

                {/* Overview Text */}
                {movie.overview && (
                    <p className="text-lg leading-relaxed text-text-secondary/90 font-light">
                        {movie.overview}
                    </p>
                )}
            </div>

            {/* Main Content */}
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                <div className="mt-12">
                    <div className="mb-8 text-center">
                        <span className="mb-2 block font-display text-sm uppercase tracking-wider text-accent-gold/80">
                            Consensus
                        </span>
                        <h2 className="font-display text-3xl text-text-primary drop-shadow-md">
                            The Internet&apos;s Verdict
                        </h2>
                    </div>

                    <div className="relative rounded-2xl border border-white/10 bg-surface-card/50 p-6 shadow-2xl backdrop-blur-sm sm:p-10">
                        <div className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-b from-white/5 to-transparent opacity-50" />

                        <ReviewSection
                            tmdbId={movie.tmdb_id}
                            mediaType={movie.media_type || "movie"}
                            movieTitle={movie.title}
                            initialReview={review}
                            onReviewUpdate={setReview}
                        />
                    </div>
                </div>

                {/* Bottom Navigation */}
                <div className="mt-8 flex items-center justify-between border-t border-surface-elevated pt-8">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-lg font-medium text-text-muted transition-colors hover:text-accent-gold"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                        Go back
                    </button>
                    <Link
                        href="/search"
                        className="inline-flex items-center gap-2 text-lg font-medium text-text-muted transition-colors hover:text-accent-gold"
                    >
                        Search another title
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </Link>
                </div>
            </div>
        </div>
    );
}   