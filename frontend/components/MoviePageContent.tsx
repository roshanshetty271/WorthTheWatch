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
            <section className="relative min-h-[70vh] flex items-end overflow-hidden">
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

                {/* Back Button - Floating top left */}
                <div className="absolute top-20 left-4 z-30 sm:left-6">
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 text-sm text-white/90 transition-all hover:bg-black/60 hover:text-white"
                    >
                        <svg
                            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
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
                        Back
                    </Link>
                </div>

                {/* Movie Info Overlay */}
                <div className="relative z-20 w-full px-4 pb-8 sm:px-6">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
                            {/* Poster */}
                            {movie.poster_url && (
                                <div className="relative mx-auto h-64 w-44 shrink-0 overflow-hidden rounded-xl shadow-2xl sm:mx-0 sm:h-72 sm:w-48 border-2 border-white/10">
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
                            <div className="flex-1 space-y-3 text-center sm:text-left">
                                <h1 className="font-display text-3xl text-white drop-shadow-lg sm:text-4xl md:text-5xl">
                                    {movie.title}
                                </h1>

                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:justify-start">
                                    {year && (
                                        <span className="rounded-full bg-white/10 backdrop-blur-sm px-3 py-1 text-white/90">
                                            {year}
                                        </span>
                                    )}
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
                                    {movie.tmdb_vote_average ? (
                                        <span className="rounded-full bg-accent-gold/20 backdrop-blur-sm px-3 py-1 text-accent-gold font-medium">
                                            ⭐ {movie.tmdb_vote_average.toFixed(1)}
                                        </span>
                                    ) : null}
                                </div>

                                {/* Verdict Badge */}
                                {review && (
                                    <div className="pt-2">
                                        <VerdictBadge verdict={review.verdict} size="lg" />
                                    </div>
                                )}

                                {/* Where to Watch - ONLY SHOW IF REVIEW EXISTS */}
                                {review && (
                                    <div className="pt-3 animate-fade-in">
                                        <StreamingAvailability tmdbId={movie.tmdb_id} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>



            {/* Overview - Open Layout */}
            {movie.overview && (
                <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
                    <p className="text-lg leading-relaxed text-text-secondary/90 font-light">
                        {movie.overview}
                    </p>
                </div>
            )}

            {/* Main Content */}
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                {/* ═══════════════════════════════════════════════════════════════════
            THE INTERNET'S VERDICT
            ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-10 rounded-2xl border border-surface-elevated bg-surface-card p-6 sm:p-8">
                    <div className="mb-6">
                        <h2 className="font-display text-xl text-accent-gold">
                            The Internet&apos;s Verdict
                        </h2>
                    </div>
                    <ReviewSection
                        tmdbId={movie.tmdb_id}
                        mediaType={movie.media_type || "movie"}
                        movieTitle={movie.title}
                        initialReview={review}
                        onReviewUpdate={setReview}
                    />
                </div>

                {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM NAVIGATION
            ═══════════════════════════════════════════════════════════════════ */}
                <div className="mt-8 flex items-center justify-between border-t border-surface-elevated pt-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent-gold"
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
                        className="inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-accent-gold"
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
