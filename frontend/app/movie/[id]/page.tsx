import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewSection from "@/components/ReviewSection";
import TrailerEmbed from "@/components/TrailerEmbed";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import type { MovieWithReview } from "@/lib/api";
import type { Metadata } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

async function getMovie(tmdbId: string, mediaType?: string): Promise<MovieWithReview | null> {
  try {
    const url = new URL(`${API_BASE}/api/movies/${tmdbId}`);
    if (mediaType) url.searchParams.set("media_type", mediaType);

    const res = await fetch(url.toString(), {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Generate JSON-LD structured data for SEO
function generateJsonLd(movie: MovieWithReview) {
  const { movie: m, review: r } = movie;

  return {
    "@context": "https://schema.org",
    "@type": m.media_type === "tv" ? "TVSeries" : "Movie",
    name: m.title,
    description: m.overview,
    image: m.poster_url || m.backdrop_url,
    datePublished: m.release_date,
    genre: m.genres?.map((g) => g.name).filter(Boolean),
    aggregateRating: m.tmdb_vote_average ? {
      "@type": "AggregateRating",
      ratingValue: m.tmdb_vote_average.toFixed(1),
      bestRating: 10,
      worstRating: 0,
      ratingCount: 1000, // Estimate
    } : undefined,
    review: r ? {
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.verdict === "WORTH IT" ? 8 : r.verdict === "NOT WORTH IT" ? 3 : 5,
        bestRating: 10,
        worstRating: 0,
      },
      reviewBody: r.review_text,
      author: {
        "@type": "Organization",
        name: "Worth the Watch?",
      },
    } : undefined,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const res = await fetch(`${API_URL}/api/movies/${id}`, { next: { revalidate: 3600 } });

    if (!res.ok) return { title: 'Worth the Watch?' };

    const data: MovieWithReview = await res.json();
    const { movie, review } = data;

    // Build full image URL - TMDB images need the full path
    const imageUrl = movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null;

    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
    const verdict = review?.verdict || '';
    const hook = review?.hook || '';
    const description = hook || `Is ${movie.title} worth watching? Find out what critics and Reddit think.`;

    return {
      title: `${movie.title}${year ? ` (${year})` : ''} — Worth the Watch?`,
      description: description,
      openGraph: {
        title: `${movie.title} — ${verdict || 'Worth the Watch?'}`,
        description: description,
        ...(imageUrl && { images: [{ url: imageUrl, width: 1280, height: 720 }] }),
        type: 'article',
        siteName: 'Worth the Watch?',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${movie.title} — ${verdict || 'Worth the Watch?'}`,
        description: description,
        ...(imageUrl && { images: [imageUrl] }),
      },
    };
  } catch (e) {
    console.error("Metadata generation error:", e);
    return { title: 'Worth the Watch?' };
  }
}

import MoviePageContent from "@/components/MoviePageContent";

export default async function MoviePage({ params, searchParams }: Props) {
  const { id } = await params;
  const sParams = await searchParams;
  const mediaType = sParams?.type;
  const data = await getMovie(id, mediaType);
  if (!data) notFound();

  // Generate JSON-LD for SEO
  const jsonLd = generateJsonLd(data);

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026')
        }}
      />
      <MoviePageContent movieData={data} />
    </>
  );
}
