"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ReviewSection from "@/components/ReviewSection";

import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import type { MovieWithReview, Review } from "@/lib/api";

interface MoviePageContentProps {
    movieData: MovieWithReview;
}

export default function MoviePageContent({ movieData }: MoviePageContentProps) {
    const { movie, review: initialReview } = movieData;
    const [review, setReview] = useState<Review | null>(initialReview);

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
            {/* ═══════════════════════════════════════════════════════════════════
          FULLSCREEN HERO BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-[55vh] md:min-h-[70vh] flex flex-col justify-between overflow-hidden">
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

                {/* Back Button - Relative to clear header */}
                <div className="relative z-30 pt-24 px-6">
                    <div className="mx-auto max-w-7xl">
                        <Link
                            href="/"
                            className="group inline-flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 transition-all hover:bg-black/60 hover:text-white hover:scale-110"
                            aria-label="Back to Home"
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
                        </Link>
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
                                        <span className="flex items-center gap-2 rounded-full bg-accent-gold/20 md:bg-black/40 md:backdrop-blur-md px-3 py-1 text-accent-gold ring-1 ring-accent-gold/50" title="TMDB Rating">
                                            {/* Simple TMDB Logo SVG */}
                                            <svg className="h-3 w-auto opacity-90" viewBox="0 0 270 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M26.8 1.4C26.8 0.6 26.2 0 25.4 0H1.4C0.6 0 0 0.6 0 1.4V18.6C0 19.4 0.6 20 1.4 20H25.4C26.2 20 26.8 19.4 26.8 18.6V1.4ZM11.6 15.6H9.2V6.4H4.8V4.4H16V6.4H11.6V15.6ZM22.4 15.6H20L17.2 7.6L14.4 15.6H12L15.6 4.4H18.8L22.4 15.6ZM42.8 1.4C42.8 0.6 42.2 0 41.4 0H29.4C28.6 0 28 0.6 28 1.4V18.6C28 19.4 28.6 20 29.4 20H41.4C42.2 20 42.8 19.4 42.8 18.6V1.4ZM38 15.6H35.6V7.6L33.6 13.6H32L30 7.6V15.6H27.6V4.4H31.2L32.8 9.6L34.4 4.4H38V15.6ZM56.8 1.4C56.8 0.6 56.2 0 55.4 0H45.4C44.6 0 44 0.6 44 1.4V18.6C44 19.4 44.6 20 45.4 20H55.4C56.2 20 56.8 19.4 56.8 18.6V1.4ZM51.6 15.6H46.4V4.4H51.6C53.6 4.4 54.4 5.6 54.4 7.6V12.4C54.4 14.4 53.6 15.6 51.6 15.6ZM51.8 13V6.8C51.8 6.4 51.6 6.2 51.2 6.2H48.8V13.6H51.2C51.6 13.6 51.8 13.4 51.8 13ZM70.8 1.4C70.8 0.6 70.2 0 69.4 0H59.4C58.6 0 58 0.6 58 1.4V18.6C58 19.4 58.6 20 59.4 20H69.4C70.2 20 70.8 19.4 70.8 18.6V1.4ZM65.6 13.2C66.8 12.8 67.4 12 67.4 10.8V7.2C67.4 5.6 66.4 4.4 64.6 4.4H60.4V15.6H64.8C66.8 15.6 67.8 14.8 67.8 13.2V13.2H65.6ZM64.8 13.6H62.8V10.8H64.8C65.2 10.8 65.4 11 65.4 11.4V13C65.4 13.4 65.2 13.6 64.8 13.6ZM64.6 9H62.8V6.4H64.6C65 6.4 65.2 6.6 65.2 7V8.4C65.2 8.8 65 9 64.6 9Z" />
                                            </svg>
                                            <span className="font-bold">{movie.tmdb_vote_average.toFixed(1)}</span>
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

                                {/* Verdict Badge */}
                                {review && (
                                    <div className="pt-2 flex justify-center md:justify-start">
                                        <VerdictBadge verdict={review.verdict} size="lg" />
                                    </div>
                                )}

                                {/* Where to Watch - ONLY SHOW IF REVIEW EXISTS */}
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
                    {/* Primary Score: IMDb or TMDB Fallback */}
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
                                {/* Only show score without label, as requested for fallback */}
                                <span className="font-bold text-white text-lg">{movie.tmdb_vote_average.toFixed(1)}</span>
                            </div>
                        </div>
                    ) : null}

                    {/* Rotten Tomatoes Critics */}
                    {review?.rt_critic_score ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">🍅</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Critics</span>
                                <span className="font-bold text-white">{review.rt_critic_score}%</span>
                            </div>
                        </div>
                    ) : null}

                    {/* Rotten Tomatoes Audience */}
                    {review?.rt_audience_score ? (
                        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">🍿</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Audience</span>
                                <span className="font-bold text-white">{review.rt_audience_score}%</span>
                            </div>
                        </div>
                    ) : null}

                    {/* Metascore */}
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
                {/* ═══════════════════════════════════════════════════════════════════
            THE INTERNET'S VERDICT
            ═══════════════════════════════════════════════════════════════════ */}
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
                        {/* Glow effect */}
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

                {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM NAVIGATION
            ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8 flex items-center justify-between border-t border-surface-elevated pt-8">
                    <Link
                        href="/"
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
                        Back to home
                    </Link>
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
