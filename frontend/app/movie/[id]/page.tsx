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
  params: { id: string };
  searchParams?: { type?: string };
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

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const mediaType = searchParams?.type;
  const data = await getMovie(params.id, mediaType);
  if (!data) return { title: "Not Found | Worth the Watch?" };

  const verdict = data.review?.verdict || "";
  return {
    title: `Is ${data.movie.title} Worth Watching? | Worth the Watch`,
    description: data.review?.review_text?.slice(0, 155) || data.movie.overview?.slice(0, 155),
    openGraph: {
      title: `${data.movie.title}: ${verdict} | Worth the Watch?`,
      description: data.review?.review_text?.slice(0, 155),
      images: data.movie.backdrop_url ? [data.movie.backdrop_url] : [],
    },
  };
}

import MoviePageContent from "@/components/MoviePageContent";

export default async function MoviePage({ params, searchParams }: Props) {
  const mediaType = searchParams?.type;
  const data = await getMovie(params.id, mediaType);
  if (!data) notFound();

  // Generate JSON-LD for SEO
  const jsonLd = generateJsonLd(data);

  return (
    <>
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MoviePageContent movieData={data} />
    </>
  );
}
