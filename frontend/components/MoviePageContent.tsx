"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { FastAverageColor } from "fast-average-color";
import ReviewSection from "@/components/ReviewSection";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import BookmarkButton from "@/components/BookmarkButton";
import SimilarMovies from "@/components/SimilarMovies";
import CinemaRoulette from "@/components/CinemaRoulette";
import ActorModal from "@/components/ActorModal";
import { logActivity } from "@/lib/logActivity";
import type { MovieWithReview, Review } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Clamp a hex color's HSL lightness to maxL (0–1) so it looks good on dark UI. */
function darkenColor(hex: string, maxL = 0.35): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (l <= maxL) return hex;

    let h = 0, s = 0;
    const d = max - min;
    s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (d !== 0) {
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }

    // Rebuild with clamped lightness
    const newL = maxL;
    const c = (1 - Math.abs(2 * newL - 1)) * s;
    const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    const m = newL - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;
    const sector = Math.floor(h * 6);
    if (sector === 0 || sector === 6) { r1 = c; g1 = x; }
    else if (sector === 1) { r1 = x; g1 = c; }
    else if (sector === 2) { g1 = c; b1 = x; }
    else if (sector === 3) { g1 = x; b1 = c; }
    else if (sector === 4) { r1 = x; b1 = c; }
    else { r1 = c; b1 = x; }

    const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

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

function formatCompactCurrency(value: number): string {
    const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);

    return formatted.replace(".0", "");
}

function ScorePill({
    label,
    value,
    icon,
    iconNode,
    className,
}: {
    label: string;
    value: string;
    icon?: string;
    iconNode?: ReactNode;
    className: string;
}) {
    return (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 shrink-0 ${className}`}>
            {iconNode ? iconNode : icon ? <span className="text-base">{icon}</span> : null}
            {label && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    {label}
                </span>
            )}
            <span className="font-bold text-white">{value}</span>
        </div>
    );
}

function ContentPill({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 shrink-0">
            <span className="text-sm" aria-hidden="true">{icon}</span>
            <span className="text-[11px] uppercase tracking-[0.16em] text-white/45">{label}</span>
            <span className="text-sm font-medium text-white/85">{value}</span>
        </div>
    );
}

export default function MoviePageContent({ movieData, initialStreaming }: MoviePageContentProps) {
    const { movie, review: initialReview } = movieData;
    const { data: session, status: sessionStatus } = useSession();
    const [review, setReview] = useState<Review | null>(initialReview);
    const [cast, setCast] = useState<CastMember[]>([]);
    const [castOpen, setCastOpen] = useState(true);
    const [ratingsOpen, setRatingsOpen] = useState(true);
    const [financialsOpen, setFinancialsOpen] = useState(false);
    const [parentsGuideOpen, setParentsGuideOpen] = useState(false);
    const [methodologyOpen, setMethodologyOpen] = useState(false);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [failedCastImages, setFailedCastImages] = useState<Set<number>>(new Set());
    const [copied, setCopied] = useState(false);
    const [rouletteOpen, setRouletteOpen] = useState(false);
    const [selectedActor, setSelectedActor] = useState<{ id: number; name: string; image: string | null } | null>(null);
    const [actorCache] = useState(() => new Map());
    const handleActorCacheUpdate = useCallback((id: number, data: any) => {
        actorCache.set(id, data);
    }, [actorCache]);

    const isHistoryAuthenticated = sessionStatus === "authenticated" && !!session?.user?.id;

    useEffect(() => {
        if (!isHistoryAuthenticated) return;

        logActivity({
            activity_type: "view",
            tmdb_id: movie.tmdb_id,
            media_type: movie.media_type || "movie",
            title: movie.title,
            poster_path: movie.poster_url || null,
        });
    }, [isHistoryAuthenticated, movie.tmdb_id, movie.media_type, movie.title, movie.poster_url]);

    const [backdropSrc, setBackdropSrc] = useState<string | null>(movie.backdrop_url || movie.poster_url || null);
    const [isPosterFallback, setIsPosterFallback] = useState<boolean>(!movie.backdrop_url && !!movie.poster_url);
    const themeColorSource = backdropSrc
        ? (backdropSrc.startsWith("http")
            ? `/api/image-proxy?url=${encodeURIComponent(backdropSrc)}`
            : backdropSrc)
        : null;

    const handleImageError = () => {
        if (backdropSrc === movie.backdrop_url && movie.poster_url) {
            setBackdropSrc(movie.poster_url);
            setIsPosterFallback(true);
        } else {
            setBackdropSrc(null);
            setIsPosterFallback(false);
        }
    };

    // Dynamic theme-color: extract dominant color from backdrop and apply to mobile browser chrome
    useEffect(() => {
        if (!themeColorSource || typeof window === "undefined") return;

        const fac = new FastAverageColor();
        let meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute("name", "theme-color");
            document.head.appendChild(meta);
        }
        const original = meta.getAttribute("content") || "#09090b";
        const mediaQuery = window.matchMedia("(max-width: 767px)");
        let cancelled = false;

        const applyThemeColor = () => {
            if (!mediaQuery.matches) {
                meta?.setAttribute("content", original);
                return;
            }

            fac.getColorAsync(themeColorSource, { algorithm: "dominant" })
                .then((color) => {
                    if (!cancelled) {
                        meta?.setAttribute("content", darkenColor(color.hex));
                    }
                })
                .catch(() => {
                    if (!cancelled) {
                        meta?.setAttribute("content", original);
                    }
                });
        };

        applyThemeColor();

        const handleViewportChange = () => {
            applyThemeColor();
        };

        if (typeof mediaQuery.addEventListener === "function") {
            mediaQuery.addEventListener("change", handleViewportChange);
        } else {
            mediaQuery.addListener(handleViewportChange);
        }

        return () => {
            cancelled = true;
            if (typeof mediaQuery.removeEventListener === "function") {
                mediaQuery.removeEventListener("change", handleViewportChange);
            } else {
                mediaQuery.removeListener(handleViewportChange);
            }
            if (meta) meta.setAttribute("content", original);
            fac.destroy();
        };
    }, [themeColorSource]);

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

    const boxOfficeDisplay = formatBoxOffice(review?.box_office);
    const budgetRevenueDisplay =
        review?.budget != null && review?.revenue != null
            ? `${formatCompactCurrency(review.budget)} → ${formatCompactCurrency(review.revenue)}`
            : review?.revenue != null
                ? formatCompactCurrency(review.revenue)
                : review?.budget != null
                    ? formatCompactCurrency(review.budget)
                    : null;
    const moneyDisplay = budgetRevenueDisplay || boxOfficeDisplay;

    const hasAnyScore = (
        review?.imdb_score != null ||
        movie.tmdb_vote_average != null ||
        review?.rt_critic_score != null ||
        review?.rt_audience_score != null ||
        review?.metascore != null ||
        review?.letterboxd_score != null ||
        moneyDisplay != null
    );
    const hasContentWarnings = (
        review?.age_rating != null ||
        review?.content_violence != null ||
        review?.content_nudity != null ||
        review?.content_language != null ||
        review?.content_drinking != null
    );

    // Review/Generate block — rendered in different positions based on review state
    const verdictBlock = (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className={review ? "mt-12" : "mt-4"}>
                <div className="mb-8 text-center relative">
                    <span className="mb-2 block font-display text-sm uppercase tracking-wider text-accent-gold/80">
                        Consensus
                    </span>
                    <div className="flex items-center justify-center gap-2">
                        <h2 className="font-display text-3xl text-text-primary drop-shadow-md">
                            The Internet&apos;s Verdict
                        </h2>
                        <div
                            className="relative"
                            onMouseEnter={() => setMethodologyOpen(true)}
                            onMouseLeave={() => setMethodologyOpen(false)}
                        >
                            <button
                                onClick={() => setMethodologyOpen(!methodologyOpen)}
                                className="text-white/25 hover:text-white/50 transition-colors mt-1"
                                aria-label="How is this verdict generated?"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                            {methodologyOpen && (
                                <>
                                    {/* Invisible backdrop — tap anywhere on mobile to dismiss */}
                                    <div className="fixed inset-0 z-10 sm:hidden" onClick={() => setMethodologyOpen(false)} />
                                    <div className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 top-full mt-2 z-20 w-72 text-center px-4 py-3 rounded-xl bg-zinc-900/95 border border-white/10 shadow-xl backdrop-blur-sm animate-fade-in">
                                        <p className="text-xs text-text-secondary leading-relaxed">
                                            Verdicts are generated by analyzing reviews from professional critics,
                                            Reddit discussions, and audience scores. AI synthesizes several sources
                                            into a single verdict.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
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
                        <button
                            onClick={() => {
                                const justSignedIn = sessionStorage.getItem("wtw_just_signed_in");
                                if (justSignedIn) {
                                    sessionStorage.removeItem("wtw_just_signed_in");
                                    window.location.href = "/";
                                } else if (window.history.length <= 1) {
                                    window.location.href = "/";
                                } else {
                                    window.history.back();
                                }
                            }}
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
                        </button>
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
                                    {review?.rated && (
                                        <span className="rounded-md bg-black/40 backdrop-blur-sm border border-white/40 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-white uppercase tracking-wider">
                                            {review.rated}
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
                                    <StreamingAvailability tmdbId={movie.tmdb_id} mediaType={movie.media_type || "movie"} initialData={initialStreaming} />
                                </div>
                                )}
                                {review && !review?.trailer_url && (
                                    <div className="mt-6 empty:hidden">
                                        <StreamingAvailability tmdbId={movie.tmdb_id} mediaType={movie.media_type || "movie"} initialData={initialStreaming} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════
            OVERVIEW — Above all data sections
            ═══════════════════════════════════════════════════════════════════ */}
            {movie.overview && (
                <div className="mx-auto max-w-4xl px-4 pb-6 sm:px-6">
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

            {/* ═══════════════════════════════════════════════════════════════════
            RATINGS — always visible, no dropdown
            ═══════════════════════════════════════════════════════════════════ */}
            {hasAnyScore && (
                <div className="mx-auto max-w-4xl px-4 pt-2 sm:px-6">
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 py-1 pb-2 [mask-image:linear-gradient(to_right,white_85%,transparent)] sm:[mask-image:none] sm:mx-0 sm:px-0 sm:flex-wrap sm:pb-1">
                        {review?.imdb_score != null ? (
                            <ScorePill
                                label=""
                                value={review.imdb_score.toFixed(1)}
                                iconNode={
                                    <div className="flex h-5 w-auto items-center justify-center rounded bg-yellow-500 px-1.5 font-black text-black text-[9px] tracking-tight" aria-hidden="true">IMDb</div>
                                }
                                className="border-yellow-500/20 bg-yellow-500/10"
                            />
                        ) : movie.tmdb_vote_average != null ? (
                            <ScorePill
                                label=""
                                value={movie.tmdb_vote_average.toFixed(1)}
                                icon="⭐"
                                className="border-accent-gold/20 bg-accent-gold/10"
                            />
                        ) : null}

                        {review?.rt_critic_score != null ? (
                            <ScorePill
                                label="Critics"
                                value={`${review.rt_critic_score}%`}
                                icon="🍅"
                                className="border-red-500/20 bg-red-500/10"
                            />
                        ) : null}

                        {review?.rt_audience_score != null ? (
                            <ScorePill
                                label="Audience"
                                value={`${review.rt_audience_score}%`}
                                icon="🍿"
                                className="border-orange-500/20 bg-orange-500/10"
                            />
                        ) : null}

                        {review?.metascore != null ? (
                            <ScorePill
                                label="Metascore"
                                value={`${review.metascore}`}
                                iconNode={
                                    <div className="flex h-5 w-5 items-center justify-center rounded bg-purple-500 font-bold text-white text-[10px]" aria-hidden="true">M</div>
                                }
                                className="border-purple-500/20 bg-purple-500/10"
                            />
                        ) : null}

                        {review?.letterboxd_score != null ? (
                            <ScorePill
                                label="Letterboxd"
                                value={review.letterboxd_score.toFixed(1)}
                                className="border-emerald-500/20 bg-emerald-500/10"
                            />
                        ) : null}

                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
            BUDGET & REVENUE — Collapsible
            ═══════════════════════════════════════════════════════════════════ */}
            {moneyDisplay && (
                <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">
                    <button
                        onClick={() => setFinancialsOpen(!financialsOpen)}
                        className="flex items-center gap-2 mb-1 py-1 group cursor-pointer"
                        aria-expanded={financialsOpen}
                    >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
                            Budget & Revenue
                        </h3>
                        <svg
                            className={`w-4 h-4 text-white/30 group-hover:text-white/50 transition-transform ${financialsOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {financialsOpen && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 py-1 pb-2 [mask-image:linear-gradient(to_right,white_85%,transparent)] sm:[mask-image:none] sm:mx-0 sm:px-0 sm:flex-wrap sm:pb-1">
                            <ScorePill
                                label={budgetRevenueDisplay ? "Budget / Revenue" : "Box Office"}
                                value={moneyDisplay}
                                icon="💰"
                                className="border-green-500/20 bg-green-500/10"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
            PARENTS GUIDE — Collapsible
            ═══════════════════════════════════════════════════════════════════ */}
            {hasContentWarnings && (
                <div className="mx-auto max-w-4xl px-4 pt-5 sm:px-6">
                    <button
                        onClick={() => setParentsGuideOpen(!parentsGuideOpen)}
                        className="flex items-center gap-2 mb-1 py-1 group cursor-pointer"
                        aria-expanded={parentsGuideOpen}
                    >
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 group-hover:text-white/60 transition-colors">
                            Parents Guide
                        </h3>
                        <svg
                            className={`w-4 h-4 text-white/30 group-hover:text-white/50 transition-transform ${parentsGuideOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {parentsGuideOpen && (
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 py-1 pb-2 [mask-image:linear-gradient(to_right,white_85%,transparent)] sm:[mask-image:none] sm:mx-0 sm:px-0 sm:flex-wrap sm:pb-1">
                            {review?.age_rating != null ? (
                                <ContentPill icon="🔞" label="Ages" value={`${review.age_rating}+`} />
                            ) : null}
                            {review?.content_violence != null ? (
                                <ContentPill icon="🔪" label="Violence" value={`${review.content_violence}/5`} />
                            ) : null}
                            {review?.content_nudity != null ? (
                                <ContentPill icon="👁" label="Nudity" value={`${review.content_nudity}/5`} />
                            ) : null}
                            {review?.content_language != null ? (
                                <ContentPill icon="💬" label="Language" value={`${review.content_language}/5`} />
                            ) : null}
                            {review?.content_drinking != null ? (
                                <ContentPill icon="🍺" label="Substances" value={`${review.content_drinking}/5`} />
                            ) : null}
                        </div>
                    )}
                </div>
            )}


            {/* ═══════════════════════════════════════════════════════════════════
            AWARDS
            ═══════════════════════════════════════════════════════════════════ */}
            {review?.awards && (
            <div className="mx-auto max-w-4xl px-4 pt-6 sm:pt-8 sm:px-6">
                <div className="mb-6 flex items-center gap-2 rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-4 py-2.5">
                    <span className="text-lg">🏆</span>
                    <p className="text-sm text-accent-gold/90 font-medium">
                        {review.awards}
                    </p>
                </div>
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
                        <>
                        <div className="flex gap-4 overflow-x-auto pt-2 pb-4 scrollbar-hide -mx-1 px-1">
                            {cast.map((person, idx) => (
                                <button
                                    key={`${person.id}-${idx}`}
                                    onClick={() => setSelectedActor({ id: person.id, name: person.name, image: person.profile_url })}
                                    className="flex-shrink-0 w-20 text-center cursor-pointer group"
                                >
                                    <div className="w-20 h-20 rounded-full overflow-hidden bg-white/5 border-2 border-accent-gold/30 sm:group-hover:border-accent-gold/60 sm:group-hover:scale-110 shadow-[0_4px_12px_rgba(0,0,0,0.5),0_0_0_2px_rgba(196,167,107,0.15)] sm:group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.6),0_0_0_3px_rgba(196,167,107,0.3)] mx-auto relative transition-all duration-200">
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
                                    <p className="mt-2 text-[11px] font-medium text-white/80 truncate group-hover:text-accent-gold transition-colors">
                                        {person.name}
                                    </p>
                                    <p className="text-[10px] text-white/40 truncate">
                                        {person.character}
                                    </p>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-white/40 text-center mt-1 mb-1 tracking-wide">Tap any cast member to see their full filmography</p>
                        </>
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

            {/* Actor Filmography Modal */}
            <ActorModal
                open={!!selectedActor}
                onClose={() => setSelectedActor(null)}
                personId={selectedActor?.id ?? null}
                actorName={selectedActor?.name ?? ""}
                actorImage={selectedActor?.image ?? null}
                excludeTmdbId={movie.tmdb_id}
                cache={actorCache}
                onCacheUpdate={handleActorCacheUpdate}
            />
        </div>
    );
}
