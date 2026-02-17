"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReviewSection from "@/components/ReviewSection";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import BookmarkButton from "@/components/BookmarkButton";
import SimilarMovies from "@/components/SimilarMovies";
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
}

export default function MoviePageContent({ movieData }: MoviePageContentProps) {
    const { movie, review: initialReview } = movieData;
    const [review, setReview] = useState<Review | null>(initialReview);
    const [cast, setCast] = useState<CastMember[]>([]);
    const [castOpen, setCastOpen] = useState(true);
    const [failedCastImages, setFailedCastImages] = useState<Set<number>>(new Set());
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
                    />
                </div>
            </div>
        </div>
    );

    return (
        <div className="animate-slide-up">
            {/* ═══════════════════════════════════════════════════════════════════
          FULLSCREEN HERO BACKDROP
          ═══════════════════════════════════════════════════════════════════ */}
            <section className="relative min-h-[30vh] md:min-h-screen flex flex-col justify-between overflow-hidden lg:overflow-visible">
                {/* Background Image Logic */}
                <div className="absolute inset-0 z-0">
                    {backdropSrc ? (
                        <>
                            <Image
                                src={backdropSrc}
                                alt={movie.title}
                                fill
                                sizes="100vw"
                                className={`object-cover ${isPosterFallback ? "object-top opacity-60" : "object-top opacity-90"}`}
                                priority
                                onError={handleImageError}
                            />
                            <div
                                className="absolute inset-0 z-10"
                                style={{
                                    background: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 60%)"
                                }}
                            />
                            {isPosterFallback && <div className="absolute inset-0 bg-black/40" />}
                        </>
                    ) : (
                        <div className="absolute inset-0 z-0 bg-gradient-to-b from-surface-elevated to-surface" />
                    )}
                </div>

                {/* Back Button */}
                <div className="relative z-30 pt-20 px-6 md:pt-24">
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
                        <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-8">
                            {/* Poster */}
                            {movie.poster_url && (
                                <div className="relative mx-auto h-44 w-32 shrink-0 overflow-hidden rounded-xl shadow-2xl sm:h-56 sm:w-40 md:mx-0 md:h-72 md:w-52 border-2 border-white/10">
                                    <Image
                                        src={movie.poster_url}
                                        alt={movie.title}
                                        fill
                                        sizes="(max-width: 768px) 160px, 208px"
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
                            <div className="flex-1 space-y-2 text-center md:space-y-3 md:text-left">
                                <h1 className="font-display text-xl text-white drop-shadow-lg sm:text-2xl md:text-5xl">
                                    {movie.title}
                                </h1>

                                {/* Rating + Year + Runtime + MPAA */}
                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm font-medium text-white/90 sm:gap-4 md:justify-start">
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
                                        <span className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1">
                                            <span className="text-base">📅</span> {year}
                                        </span>
                                    )}
                                    {movie.runtime && (
                                        <span className="flex items-center gap-1.5 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1">
                                            <span className="text-base">⏱️</span> {movie.runtime} min
                                        </span>
                                    )}

                                    {/* MPAA Rating Badge */}
                                    {(review as any)?.rated && (
                                        <span className="rounded-md bg-black/40 backdrop-blur-sm border border-white/40 px-2.5 py-1 text-xs font-bold text-white uppercase tracking-wider">
                                            {(review as any).rated}
                                        </span>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm md:justify-start">
                                    {genres && (
                                        <span className="rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 text-white border border-white/10">
                                            {genres}
                                        </span>
                                    )}
                                    {movie.media_type && (
                                        <span className="rounded-full bg-black/40 backdrop-blur-sm px-3 py-1 capitalize text-white border border-white/10">
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

                                {review && (
                                    <div className="pt-3 animate-fade-in flex flex-wrap items-center gap-4 justify-center md:justify-start">
                                        {/* Trailer jump link */}
                                        {review.trailer_url && (
                                            <button
                                                onClick={() => {
                                                    document.getElementById("trailer-section")?.scrollIntoView({
                                                        behavior: "smooth",
                                                        block: "center"
                                                    });
                                                }}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF0000] hover:bg-[#cc0000] text-white font-bold text-sm tracking-wide rounded-full transition-all shadow-lg shadow-red-900/30 hover:shadow-red-900/50 active:scale-95 group"
                                            >
                                                <svg className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                                Watch Trailer
                                            </button>
                                        )}

                                        <StreamingAvailability tmdbId={movie.tmdb_id} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
            SCORES, AWARDS & OVERVIEW
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

                    {/* Box Office */}
                    {boxOfficeDisplay && (
                        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="text-lg">💰</span>
                            <div className="flex flex-col leading-none">
                                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Box Office</span>
                                <span className="font-bold text-white">{boxOfficeDisplay}</span>
                            </div>
                        </div>
                    )}
                </div>

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
                    <p className="text-lg leading-relaxed text-text-secondary/90 font-light">
                        {movie.overview}
                    </p>
                )}
            </div>


            {/* ═══════════════════════════════════════════════════════════════════
            CAST LIST — Collapsible
            ═══════════════════════════════════════════════════════════════════ */}
            {cast.length > 0 && (
                <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6">
                    <button
                        onClick={() => setCastOpen(!castOpen)}
                        className="flex items-center gap-2 mb-4 group cursor-pointer"
                    >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
                            Cast
                        </h3>
                        <svg
                            className={`w-3.5 h-3.5 text-white/30 group-hover:text-white/50 transition-all ${castOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
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
                                                <span className="text-lg text-white/20">👤</span>
                                                <span className="text-[7px] text-white/20 mt-0.5">{person.name.split(' ')[0]}</span>
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
            VERDICT — Always after cast
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
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                {/* Bottom Navigation */}
                <div className="mt-8 flex items-center justify-between border-t border-surface-elevated pt-8">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-lg font-medium text-text-secondary transition-colors hover:text-accent-gold"
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
                        className="inline-flex items-center gap-2 text-lg font-medium text-text-secondary transition-colors hover:text-accent-gold"
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