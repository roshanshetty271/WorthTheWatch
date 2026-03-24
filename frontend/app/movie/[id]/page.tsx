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

const SITE_URL = 'https://worth-the-watch.vercel.app';

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
      ratingCount: 1000,
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

function generateFaqJsonLd(movie: MovieWithReview) {
  const { movie: m, review: r } = movie;
  const year = m.release_date ? ` (${new Date(m.release_date).getFullYear()})` : '';

  const faqs: Array<{ question: string; answer: string }> = [];

  if (r) {
    const verdictText = r.verdict === "WORTH IT" ? "Yes" : r.verdict === "NOT WORTH IT" ? "No" : "It depends";
    faqs.push({
      question: `Is ${m.title}${year} worth watching?`,
      answer: `${verdictText} — ${r.hook || r.review_text?.slice(0, 200) || `Check the full verdict on Worth the Watch.`}`,
    });
  } else {
    faqs.push({
      question: `Is ${m.title}${year} worth watching?`,
      answer: `Generate a free AI-powered verdict on Worth the Watch to find out what Reddit, critics, and real viewers think.`,
    });
  }

  if (r?.rt_critic_score || r?.metascore) {
    const scores: string[] = [];
    if (r.rt_critic_score) scores.push(`Rotten Tomatoes: ${r.rt_critic_score}%`);
    if (r.metascore) scores.push(`Metacritic: ${r.metascore}/100`);
    if (r.imdb_score) scores.push(`IMDb: ${r.imdb_score}/10`);
    faqs.push({
      question: `What do critics say about ${m.title}?`,
      answer: scores.join('. ') + '.',
    });
  }

  faqs.push({
    question: `Where can I watch ${m.title}?`,
    answer: `Check streaming availability for ${m.title} on Worth the Watch to see which platforms have it.`,
  });

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function generateBreadcrumbJsonLd(movie: MovieWithReview) {
  const { movie: m } = movie;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: m.media_type === "tv" ? "TV Shows" : "Movies", item: `${SITE_URL}/browse/worth-it` },
      { "@type": "ListItem", position: 3, name: m.title, item: `${SITE_URL}/movie/${m.tmdb_id}` },
    ],
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${API_URL}/api/movies/${id}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return { title: 'Worth the Watch?' };
    const data: MovieWithReview = await res.json();
    const { movie, review } = data;

    const imageUrl = movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : '/twitter-share.jpg';

    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
    const yearStr = year ? ` (${year})` : '';
    const verdict = review?.verdict || '';
    const hook = review?.hook || '';

    const verdictSnippet = verdict ? ` Verdict: ${verdict}.` : '';
    const description = (hook.length > 50 ? hook : null)
      || `Is ${movie.title}${yearStr} worth watching? See what Reddit, critics, and real viewers say.${verdictSnippet} No spoilers, just the truth.`;

    const pageTitle = `Is ${movie.title}${yearStr} Worth Watching?${verdict ? ` — ${verdict}` : ''} | Worth the Watch?`;
    const ogTitle = verdict ? `${movie.title} — ${verdict}` : `Is ${movie.title} Worth Watching?`;

    return {
      title: pageTitle,
      description: description,
      alternates: {
        canonical: `${SITE_URL}/movie/${id}`,
      },
      openGraph: {
        title: ogTitle,
        description: description,
        images: [{ url: imageUrl, width: 1280, height: 720 }],
        type: 'article',
        siteName: 'Worth the Watch?',
      },
      twitter: {
        card: 'summary_large_image',
        title: ogTitle,
        description: description,
        images: [imageUrl],
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

  const jsonLd = generateJsonLd(data);
  const faqJsonLd = generateFaqJsonLd(data);
  const breadcrumbJsonLd = generateBreadcrumbJsonLd(data);

  const sanitize = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sanitize(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sanitize(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: sanitize(breadcrumbJsonLd) }} />
      <MoviePageContent movieData={data} />
    </>
  );
}
