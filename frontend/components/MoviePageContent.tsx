"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import ReviewSection from "@/components/ReviewSection";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import BookmarkButton from "@/components/BookmarkButton";
import SimilarMovies from "@/components/SimilarMovies";
import CinemaRoulette from "@/components/CinemaRoulette";
import { logActivity } from "@/lib/logActivity";
import type { MovieWithReview, Review } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface CastMember {
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
    profile_url: string | null;
}

interface MoviePageContentProps {
    movieData: MovieWithReview;
    initialStreaming?: any;
}

export default function MoviePageContent({ movieData, initialStreaming }: MoviePageContentProps) {
    const { movie, review: initialReview } = movieData;
    const [review, setReview] = useState<Review | null>(initialReview);
    const [cast, setCast] = useState<CastMember[]>([]);
    const [castOpen, setCastOpen] = useState(true);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [failedCastImages, setFailedCastImages] = useState<Set<number>>(new Set());
    const [copied, setCopied] = useState(false);
    const [rouletteOpen, setRouletteOpen] = useState(false);
    useEffect(() => {
        logActivity({
            activity_type: "view",
            tmdb_id: movie.tmdb_id,
            media_type: movie.media_type || "movie",
            title: movie.title,
            poster_path: movie.poster_url || null,
        });
    }, [movie.tmdb_id, movie.media_type, movie.title, movie.poster_url]);

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

    // Fetch cast on mount
    useEffect(() => {
        async function fetchCast() {
            try {
                const res = await fetch(
                    `${API_BASE}/api/movies/${movie.tmdb_id}/credits?media_type=${movie.media_type || "movie"}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setCast((data.cast || []).filter((person: CastMember) => person.profile_url));
                }
            } catch { }
        }
        fetchCast();
    }, [movie.tmdb_id, movie.media_type]);

    // Format box office for display
    const formatBoxOffice = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        // Already formatted like "$858,373,000"
        if (raw.startsWith("$")) return raw;
        return `$${raw}`;
    };

    const boxOfficeDisplay = formatBoxOffice((review as any)?.box_office);

    const hasAnyScore = !!(
        review?.imdb_score || movie.tmdb_vote_average ||
        review?.rt_critic_score || review?.rt_audience_score ||
        review?.metascore || boxOfficeDisplay
    );

    // Review/Generate block — rendered in different positions based on review state
    const verdictBlock = (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className={review ? "mt-12" : "mt-4"}>
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
                        releaseDate={movie.release_date || null}
                        posterPath={movie.poster_url || movie.poster_path || null}
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div>
            {/* ═══════════════════════════════════════════════════════════════════
          FULLSCREEN HERO BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative flex min-h-[80svh] md:min-h-[100svh] flex-col">
                {/* Background Image — fills entire section, fades via overlays */}
                {backdropSrc ? (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                        <Image
                            src={backdropSrc}
                            alt={movie.title}
                            fill
                            sizes="100vw"
                            className={`hidden md:block object-cover ${isPosterFallback ? "object-top opacity-60" : "object-[center_15%] opacity-90"}`}
                            priority
                            onError={handleImageError}
                            unoptimized
                        />
                        <Image
                            src={movie.poster_url || backdropSrc}
                            alt={movie.title}
                            fill
                            sizes="100vw"
                            className="block md:hidden object-cover object-[center_20%] opacity-90"
                            priority
                            unoptimized
                        />
                        {/* Top fade — anchors navbar on a dark edge */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-transparent" style={{ height: '30%' }} />
                        {/* Bottom fade — blends into page surface */}
                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent" />
                        {isPosterFallback && <div className="absolute inset-0 bg-black/40" />}
                    </div>
                ) : (
                    <div className="absolute inset-0 z-0 bg-gradient-to-b from-surface-elevated to-surface" />
                )}

                {/* Back Button */}
                <div className="relative z-30 pt-20 px-4 sm:px-6 md:pt-24">
                    <div className="mx-auto max-w-7xl">
                        <Link
                            href="/"
                            className="group inline-flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/90 transition-colors duration-200 hover:bg-black/60 hover:text-white hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
                            aria-label="Go back"
                        >
                            <svg
                                className="h-6 w-6 transition-transform group-hover:-translate-x-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                aria-hidden="true"
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

                {/* Movie Info Overlay — hero area: poster + title + meta */}
                <div className="relative z-20 w-full px-4 pt-8 pb-10 sm:px-6 sm:pt-10 sm:pb-12 md:pt-12 md:pb-14">
                    <div className="mx-auto max-w-7xl">
                        <div className="flex flex-col items-center gap-3 md:flex-row md:items-end md:gap-8">
                            {/* Poster */}
                            {movie.poster_url && (
                                <div className="relative h-44 w-28 shrink-0 overflow-hidden rounded-xl shadow-2xl sm:h-56 sm:w-40 md:h-72 md:w-52 border-2 border-white/10">
                                    <Image
                                        src={movie.poster_url}
                                        alt={movie.title}
                                        fill
                                        sizes="(max-width: 768px) 112px, 208px"
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

                            {/* Title + Meta + Actions column */}
                            <div className="flex-1 min-w-0 text-center md:text-left">
                                <h1 className="font-display text-xl text-white text-shadow-hero sm:text-2xl md:text-5xl">
                                    {movie.title}
                                </h1>

                                {/* Year + Runtime + MPAA */}
                                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs font-medium text-white/90 sm:gap-3 sm:text-sm md:justify-start">
                                    {year && (
                                        <span className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-0.5 sm:px-3 sm:py-1">
                                            <span className="hidden sm:inline text-base" aria-hidden="true">📅</span> {year}
                                        </span>
                                    )}
                                    {movie.runtime && (
                                        <span className="flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-0.5 sm:px-3 sm:py-1">
                                            <span className="hidden sm:inline text-base" aria-hidden="true">⏱️</span> {movie.runtime} min
                                        </span>
                                    )}
                                    {(review as any)?.rated && (
                                        <span className="rounded-md bg-black/40 backdrop-blur-sm border border-white/40 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
                                            {(review as any).rated}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs sm:text-sm md:justify-start">
                                    {genres && (
                                        <span className="rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-0.5 sm:px-3 sm:py-1 text-white border border-white/10">
                                            {genres}
                                        </span>
                                    )}
                                    {movie.media_type && (
                                        <span className="rounded-full bg-black/40 backdrop-blur-sm px-2.5 py-0.5 sm:px-3 sm:py-1 capitalize text-white border border-white/10">
                                            {movie.media_type}
                                        </span>
                                    )}
                                </div>

                                {/* Verdict Badge + Save + Share */}
                                {review && (
                                <div className="mt-4 flex w-full items-center justify-center gap-3 md:justify-start animate-fade-in">
                                    {review && (
                                        <>
                                            <VerdictBadge verdict={review.verdict} size="lg" />
                                            <BookmarkButton
                                                tmdb_id={movie.tmdb_id}
                                                title={movie.title}
                                                poster_path={movie.poster_path || null}
                                                verdict={review.verdict}
                                                variant="page"
                                            />
                                            <button
                                                onClick={async () => {
                                                    const url = window.location.href;
                                                    const shareData = {
                                                        title: `${movie.title} — ${review.verdict}`,
                                                        text: `Is ${movie.title} worth watching? Check the verdict!`,
                                                        url,
                                                    };
                                                    try {
                                                        if (navigator.share) {
                                                            await navigator.share(shareData);
                                                        } else {
                                                            await navigator.clipboard.writeText(url);
                                                            setCopied(true);
                                                            setTimeout(() => setCopied(false), 2000);
                                                        }
                                                    } catch {
                                                        await navigator.clipboard.writeText(url);
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }
                                                }}
                                                className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white transition-colors duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none"
                                                aria-label="Share this movie"
                                                title="Share"
                                            >
                                                {copied ? (
                                                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                    </svg>
                                                )}
                                            </button>
                                            {copied && (
                                                <span className="text-xs text-green-400 animate-fade-in font-medium">
                                                    Link copied!
                                                </span>
                                            )}
                                        </>
                                    )}
                                </div>
                                )}

                                {/* Trailer + Streaming */}
                                {review?.trailer_url && (
                                <div className="mt-6 flex w-full items-center gap-4 flex-wrap justify-center md:justify-start animate-fade-in">
                                    <button
                                        onClick={() => {
                                            document.getElementById("trailer-section")?.scrollIntoView({
                                                behavior: "smooth",
                                                block: "center"
                                            });
                                        }}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-[#FF0000] hover:bg-[#cc0000] text-white font-bold text-sm tracking-wide rounded-full transition-colors duration-200 shadow-lg shadow-red-900/30 hover:shadow-red-900/50 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none group shrink-0"
                                    >
                                        <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                            <path d="M8 5v14l11-7z" />
                                        </svg>
                                        Trailer
                                    </button>
                                    <StreamingAvailability tmdbId={movie.tmdb_id} initialData={initialStreaming} />
                                </div>
                                )}
                                {review && !review?.trailer_url && (
                                    <div className="mt-6 empty:hidden">
                                        <StreamingAvailability tmdbId={movie.tmdb_id} initialData={initialStreaming} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
            SCORES — single scrollable row with divider lines
            ═══════════════════════════════════════════════════════════════════ */}
            {hasAnyScore && (
            <div className="mx-auto max-w-4xl px-4 sm:px-6">
                <div className="py-5">
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 py-1 sm:mx-0 sm:px-0 sm:flex-wrap">
                        {review?.imdb_score ? (
                            <div className="flex items-center gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 shrink-0">
                                <span className="text-base font-bold text-yellow-500">IMDb</span>
                                <span className="font-bold text-white">{review.imdb_score}</span>
                            </div>
                        ) : movie.tmdb_vote_average ? (
                            <div className="flex items-center gap-2 rounded-lg border border-accent-gold/20 bg-accent-gold/10 px-3 py-1.5 shrink-0">
                                <span className="text-base">⭐</span>
                                <span className="font-bold text-white">{movie.tmdb_vote_average.toFixed(1)}</span>
                            </div>
                        ) : null}

                        {review?.rt_critic_score ? (
                            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 shrink-0">
                                <span className="text-base">🍅</span>
                                <span className="font-bold text-white">{review.rt_critic_score}%</span>
                            </div>
                        ) : null}

                        {review?.rt_audience_score ? (
                            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 shrink-0">
                                <span className="text-base">🍿</span>
                                <span className="font-bold text-white">{review.rt_audience_score}%</span>
                            </div>
                        ) : null}

                        {review?.metascore ? (
                            <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 shrink-0">
                                <div className="flex h-5 w-5 items-center justify-center rounded bg-purple-500 font-bold text-white text-[10px]" aria-hidden="true">M</div>
                                <span className="font-bold text-white">{review.metascore}</span>
                            </div>
                        ) : null}

                        {boxOfficeDisplay && (
                            <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 shrink-0">
                                <span className="text-base">💰</span>
                                <span className="font-bold text-white text-sm">{boxOfficeDisplay}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
            AWARDS & OVERVIEW
            ═══════════════════════════════════════════════════════════════════ */}
            {((review as any)?.awards || movie.overview) && (
            <div className="mx-auto max-w-4xl px-4 pt-6 sm:pt-8 sm:px-6">
                {/* Awards */}
                {(review as any)?.awards && (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-4 py-2.5">
                        <span className="text-lg">🏆</span>
                        <p className="text-sm text-accent-gold/90 font-medium">
                            {(review as any).awards}
                        </p>
                    </div>
                )}

                {/* Overview Text */}
                {movie.overview && (
                    <div>
                        <p className={`text-base sm:text-lg leading-relaxed text-text-secondary/90 font-light ${!overviewExpanded ? "line-clamp-4 sm:line-clamp-none" : ""}`}>
                            {movie.overview}
                        </p>
                        {movie.overview.length > 200 && (
                            <button
                                onClick={() => setOverviewExpanded(!overviewExpanded)}
                                className="text-xs text-accent-gold mt-2 hover:text-accent-goldLight transition-colors sm:hidden"
                            >
                                {overviewExpanded ? "Show less" : "Read more"}
                            </button>
                        )}
                    </div>
                )}
            </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
            CAST LIST — Collapsible
            ═══════════════════════════════════════════════════════════════════ */}
            {cast.length > 0 && (
                <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
                    <button
                        onClick={() => setCastOpen(!castOpen)}
                        className="flex items-center gap-2 mb-4 py-2 group cursor-pointer"
                        aria-expanded={castOpen}
                    >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
                            Cast
                        </h3>
                        <svg
                            className={`w-4 h-4 text-white/30 group-hover:text-white/50 transition-transform ${castOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {castOpen && (
                        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                            {cast.map((person) => (
                                <div
                                    key={person.id}
                                    className="flex-shrink-0 w-20 text-center"
                                >
                                    <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border border-white/10 mx-auto relative">
                                        {person.profile_url && !failedCastImages.has(person.id) ? (
                                            <Image
                                                src={person.profile_url}
                                                alt={person.name}
                                                fill
                                                className="object-cover"
                                                sizes="80px"
                                                unoptimized
                                                onError={() => setFailedCastImages(prev => new Set(prev).add(person.id))}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-white/[0.02]">
                                                <span className="text-lg text-white/20" aria-hidden="true">👤</span>
                                                <span className="text-[10px] text-white/20 mt-0.5">{person.name.split(' ')[0]}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="mt-2 text-[11px] font-medium text-white/80 truncate">
                                        {person.name}
                                    </p>
                                    <p className="text-[10px] text-white/40 truncate">
                                        {person.character}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
            VERDICT — After overview and cast
            ═══════════════════════════════════════════════════════════════════ */}
            {verdictBlock}

            {/* ═══════════════════════════════════════════════════════════════════
            SIMILAR / RECOMMENDATIONS — Only after review exists
            ═══════════════════════════════════════════════════════════════════ */}
            {review && (
                <div className="mx-auto max-w-4xl px-4 sm:px-6">
                    <SimilarMovies
                        tmdbId={movie.tmdb_id}
                        mediaType={movie.media_type || "movie"}
                        title={movie.title}
                    />
                </div>
            )}

            {/* Main content wrapper for bottom nav */}
            <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8 sm:px-6">
                {/* Bottom Navigation */}
                <div className="mt-6 sm:mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-between sm:items-center pt-6 sm:pt-8">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-accent-gold/40 hover:text-accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
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
                    </Link>
                    <button
                        onClick={() => setRouletteOpen(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-5 py-2.5 text-sm font-medium text-accent-gold transition-all duration-200 hover:bg-accent-gold/20 hover:border-accent-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                    >
                        Can&apos;t Decide?
                    </button>
                    <Link
                        href="/search"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white/5 border border-white/10 px-5 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:border-accent-gold/40 hover:text-accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
                    >
                        Search another title
                        <svg
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
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
                <CinemaRoulette isOpen={rouletteOpen} onClose={() => setRouletteOpen(false)} />
            </div>

        </div>
    );
}