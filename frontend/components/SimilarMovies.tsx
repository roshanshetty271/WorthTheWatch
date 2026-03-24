"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface SimilarMovie {
    tmdb_id: number;
    title: string;
    media_type: string;
    poster_url: string | null;
    tmdb_vote_average: number | null;
    release_date: string | null;
    verdict?: string | null;
    has_review?: boolean;
}

interface SimilarMoviesProps {
    tmdbId: number;
    mediaType: string;
    title: string;
}

function PosterImage({ src, alt, sizes = "120px" }: { src: string | null; alt: string; sizes?: string }) {
    const [error, setError] = useState(false);
    if (error || !src) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/10 to-white/[0.02] p-2">
                <span className="text-2xl mb-1 opacity-40">🎬</span>
                <span className="text-[9px] text-white/40 text-center line-clamp-2 font-medium">{alt}</span>
            </div>
        );
    }
    return (
        <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={sizes}
            unoptimized
            onError={() => setError(true)}
        />
    );
}

export default function SimilarMovies({ tmdbId, mediaType, title }: SimilarMoviesProps) {
    const [movies, setMovies] = useState<SimilarMovie[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSimilar() {
            try {
                const res = await fetch(
                    `${API_BASE}/api/movies/${tmdbId}/recommendations?media_type=${mediaType}`
                );
                if (res.ok) {
                    const data = await res.json();
                    setMovies(data.results || []);
                }
            } catch {
                setMovies([]);
            } finally {
                setLoading(false);
            }
        }
        fetchSimilar();
    }, [tmdbId, mediaType]);

    if (!loading && movies.length === 0) return null;

    return (
        <section className="py-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">
                If you liked {title}
            </h3>

            {loading ? (
                <div className="flex gap-4 overflow-hidden">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="shrink-0 w-[120px] animate-pulse">
                            <div className="aspect-[2/3] rounded-lg bg-white/5" />
                            <div className="mt-2 h-2.5 bg-white/5 rounded w-3/4" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                    {movies.map((movie) => (
                        <Link
                            key={movie.tmdb_id}
                            href={`/movie/${movie.tmdb_id}?type=${movie.media_type}`}
                            className="shrink-0 w-[120px] group"
                        >
                            <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-accent-gold/30 transition-all">
                                <PosterImage src={movie.poster_url} alt={movie.title} />

                                {/* Rating */}
                                {movie.tmdb_vote_average && movie.tmdb_vote_average > 0 && (
                                    <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[9px] font-bold text-accent-gold z-10">
                                        ★ {movie.tmdb_vote_average.toFixed(1)}
                                    </div>
                                )}

                                {/* Verdict badge if we have a review */}
                                {movie.verdict && (
                                    <div className="absolute bottom-1.5 left-1.5 z-10">
                                        <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full border backdrop-blur-sm ${movie.verdict === "WORTH IT"
                                                ? "text-green-400 bg-green-400/10 border-green-400/30"
                                                : movie.verdict === "NOT WORTH IT"
                                                    ? "text-red-400 bg-red-400/10 border-red-400/30"
                                                    : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                                            }`}>
                                            {movie.verdict}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <p className="mt-1.5 text-[11px] font-medium text-white/60 truncate group-hover:text-white/90 transition-colors">
                                {movie.title}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    );
}