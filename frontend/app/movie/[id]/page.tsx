import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewSection from "@/components/ReviewSection";
import TrailerEmbed from "@/components/TrailerEmbed";
import VerdictBadge from "@/components/VerdictBadge";
import StreamingAvailability from "@/components/StreamingAvailability";
import type { MovieWithReview } from "@/lib/api";
import type { Metadata, Viewport } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_THEME_COLOR = "#d4a843";

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

async function getStreaming(tmdbId: string, mediaType?: string) {
  try {
    const url = new URL(`${API_BASE}/api/movies/${tmdbId}/streaming`);
    if (mediaType) url.searchParams.set("media_type", mediaType);
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function clampThemeColor(r: number, g: number, b: number, maxL = 0.35): string {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (l <= maxL) {
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  let h = 0;
  let s = 0;
  const d = max - min;
  s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }

  const newL = maxL;
  const c = (1 - Math.abs(2 * newL - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = newL - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  const sector = Math.floor(h * 6);

  if (sector === 0 || sector === 6) {
    r1 = c;
    g1 = x;
  } else if (sector === 1) {
    r1 = x;
    g1 = c;
  } else if (sector === 2) {
    g1 = c;
    b1 = x;
  } else if (sector === 3) {
    g1 = x;
    b1 = c;
  } else if (sector === 4) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const toHex = (value: number) =>
    Math.round((value + m) * 255).toString(16).padStart(2, "0");

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

async function getMovieThemeColor(imageUrl?: string | null): Promise<string> {
  if (!imageUrl) return DEFAULT_THEME_COLOR;

  try {
    const response = await fetch(imageUrl, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) return DEFAULT_THEME_COLOR;

    const sharp = (await import("sharp")).default;
    const buffer = Buffer.from(await response.arrayBuffer());
    const { data } = await sharp(buffer)
      .resize(1, 1, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return clampThemeColor(data[0], data[1], data[2]);
  } catch {
    return DEFAULT_THEME_COLOR;
  }
}

const SITE_URL = 'https://worth-the-watch.com';

export async function generateViewport({ params, searchParams }: Props): Promise<Viewport> {
  const { id } = await params;
  const sParams = await searchParams;
  const mediaType = sParams?.type;
  const movie = await getMovie(id, mediaType);
  const themeColor = await getMovieThemeColor(
    movie?.movie.backdrop_url || movie?.movie.poster_url
  );

  return {
    themeColor,
  };
}

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

  if (r) {
    const goodBad = r.verdict === "WORTH IT" ? "good" : r.verdict === "NOT WORTH IT" ? "not great" : "a mixed bag";
    faqs.push({
      question: `Should I watch ${m.title}?`,
      answer: `${r.verdict === "WORTH IT" ? "Yes" : r.verdict === "NOT WORTH IT" ? "Probably not" : "It depends on your taste"} — ${r.vibe || r.hook || r.review_text?.slice(0, 150) || "See the full verdict on Worth the Watch."}`,
    });

    faqs.push({
      question: `Is ${m.title}${year} good or bad?`,
      answer: `${m.title} is ${goodBad}. ${r.hook || r.review_text?.slice(0, 150) || ""}`.trim(),
    });

    if (r.praise_points?.length && r.criticism_points?.length) {
      const pros = r.praise_points.slice(0, 2).join('; ');
      const cons = r.criticism_points.slice(0, 2).join('; ');
      faqs.push({
        question: `What are the pros and cons of ${m.title}?`,
        answer: `Pros: ${pros}. Cons: ${cons}.`,
      });
    }
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

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  try {
    const { id } = await params;
    const sParams = await searchParams;
    const mediaType = sParams?.type;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const url = mediaType
      ? `${API_URL}/api/movies/${id}?media_type=${mediaType}`
      : `${API_URL}/api/movies/${id}`;
    const res = await fetch(url, {
      next: { revalidate: 600 }
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
        canonical: mediaType === "tv" ? `${SITE_URL}/movie/${id}?type=tv` : `${SITE_URL}/movie/${id}`,
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
  const [data, streaming] = await Promise.all([
    getMovie(id, mediaType),
    getStreaming(id, mediaType),
  ]);
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
      <MoviePageContent movieData={data} initialStreaming={streaming} />
    </>
  );
}
