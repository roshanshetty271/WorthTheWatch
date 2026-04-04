"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Review } from "@/lib/api";
import { useWatchlist } from "@/lib/useWatchlist";
import { useSession } from "next-auth/react";
import VerdictBadge from "./VerdictBadge";
import SentimentBar from "./SentimentBar";
import TrailerEmbed from "./TrailerEmbed";
import ReviewFeedback from "./ReviewFeedback";
import BookmarkButton from "./BookmarkButton";

interface ReviewContentProps {
  review: Review;
  releaseDate?: string | null;
  tmdbId?: number;
  onRefresh?: () => void;
  movieTitle?: string;
  posterPath?: string | null;
}

// Known allowed tags for splitting concatenated strings
const KNOWN_TAGS = [
  "Action-Packed", "Cerebral", "Dark", "Dialogue-Heavy",
  "Emotional", "Family-Friendly", "Fast-Paced", "Feel-Good",
  "Funny", "Gory", "Gritty", "Heartbreaking", "Mind-Bending",
  "Sexy", "Slow-Burn", "Violent", "Visual-Masterpiece", "Whimsical",
];

/**
 * Fix tags that got concatenated by the LLM.
 * e.g. "CerebralEmotionalVisual-Masterpiece" → ["Cerebral", "Emotional", "Visual-Masterpiece"]
 * Also handles normal tags that just need cleanup.
 */
function fixTags(rawTags: string[] | null | undefined): string[] {
  if (!rawTags || rawTags.length === 0) return [];

  const result: string[] = [];

  for (const raw of rawTags) {
    if (!raw || typeof raw !== "string") continue;

    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;

    // Check if this is a single known tag (exact or case-insensitive match)
    const exactMatch = KNOWN_TAGS.find(
      (t) => t.toLowerCase() === trimmed.toLowerCase() ||
        t.toLowerCase().replace(/-/g, "") === trimmed.toLowerCase().replace(/-/g, "")
    );

    if (exactMatch) {
      if (!result.includes(exactMatch)) result.push(exactMatch);
      continue;
    }

    // If the tag is suspiciously long (>20 chars), it is probably concatenated
    // Try to extract known tags from the string
    if (trimmed.length > 20) {
      let remaining = trimmed;
      // Sort by length descending so "Visual-Masterpiece" matches before "Visual"
      const sorted = [...KNOWN_TAGS].sort((a, b) => b.length - a.length);

      for (const known of sorted) {
        // Check both hyphenated and non-hyphenated forms
        const knownClean = known.toLowerCase().replace(/-/g, "");
        const remainingClean = remaining.toLowerCase().replace(/-/g, "");

        if (remainingClean.includes(knownClean)) {
          if (!result.includes(known)) result.push(known);
          // Remove the matched portion
          const idx = remainingClean.indexOf(knownClean);
          const before = remaining.substring(0, idx);
          const after = remaining.substring(idx + knownClean.length);
          remaining = before + after;
        }
      }
    } else {
      // Short but unrecognized — try normalizing: "feel good" → "Feel-Good"
      const normalized = trimmed
        .split(/[\s-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("-");

      const normalizedMatch = KNOWN_TAGS.find(
        (t) => t.toLowerCase() === normalized.toLowerCase()
      );

      if (normalizedMatch) {
        if (!result.includes(normalizedMatch)) result.push(normalizedMatch);
      } else {
        // Unknown tag — still display it, just clean it up
        if (!result.includes(trimmed)) result.push(trimmed);
      }
    }
  }

  return result.slice(0, 5); // Max 5 tags
}

// Helper to format review text into readable paragraphs
const formatReviewText = (text: string) => {
  if (!text) return [];

  // 1. Initial split by double newlines
  const initialParas = text.split(/\n\s*\n/).filter(Boolean);
  const finalParas: string[] = [];

  // 2. Break down any individual paragraphs that are still too long (>350 chars)
  initialParas.forEach(para => {
    if (para.length > 350) {
      const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g);
      if (!sentences) {
        finalParas.push(para.trim());
        return;
      }

      let currentPara = "";
      sentences.forEach((sentence) => {
        currentPara += sentence;
        // Split if we hit ~280 chars to avoid very long blocks
        if (currentPara.length > 280) {
          finalParas.push(currentPara.trim());
          currentPara = "";
        }
      });

      if (currentPara.trim()) {
        finalParas.push(currentPara.trim());
      }
    } else {
      finalParas.push(para.trim());
    }
  });

  return finalParas;
};

interface ResolvedMovie {
  tmdb_id: number;
  media_type: string;
}

function extractMentionedTitles(text: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const titles: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (!titles.includes(match[1])) titles.push(match[1]);
  }
  return titles;
}

/**
 * Parse [[Movie Title]] markers in review text into clickable links.
 * When resolvedMap has an entry, links go directly to the movie page.
 * Otherwise falls back to /search?q=...
 */
function parseMovieMentions(
  text: string,
  resolvedMap: Record<string, ResolvedMovie>
): ReactNode[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const movieName = match[1];
    const resolved = resolvedMap[movieName];
    const href = resolved
      ? `/movie/${resolved.tmdb_id}?type=${resolved.media_type}`
      : `/search?q=${encodeURIComponent(movieName)}`;
    parts.push(
      <Link
        key={`mention-${match.index}`}
        href={href}
        className="text-accent-gold underline decoration-accent-gold/40 underline-offset-2 hover:text-accent-goldLight hover:decoration-accent-gold transition-colors duration-150"
      >
        {movieName}
      </Link>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReviewContent({ review, releaseDate, tmdbId, onRefresh, movieTitle, posterPath }: ReviewContentProps) {
  const paragraphs = formatReviewText(review.review_text);
  const tags = fixTags(review.tags);
  const { data: session } = useSession();
  const { isSaved, mounted: watchlistMounted } = useWatchlist();
  const [showSaveCTA, setShowSaveCTA] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const [resolvedMentions, setResolvedMentions] = useState<Record<string, ResolvedMovie>>({});

  const mentionedTitles = useMemo(
    () => extractMentionedTitles(review.review_text),
    [review.review_text]
  );

  useEffect(() => {
    if (mentionedTitles.length === 0) return;
    let cancelled = false;

    async function resolve() {
      const map: Record<string, ResolvedMovie> = {};
      await Promise.all(
        mentionedTitles.map(async (title) => {
          try {
            const res = await fetch(
              `${API_BASE}/api/search/quick?q=${encodeURIComponent(title)}`
            );
            if (!res.ok) return;
            const data = await res.json();
            const first = data.results?.[0];
            if (first) {
              map[title] = { tmdb_id: first.tmdb_id, media_type: first.media_type };
            }
          } catch { /* ignore - fallback link still works */ }
        })
      );
      if (!cancelled) setResolvedMentions(map);
    }

    resolve();
    return () => { cancelled = true; };
  }, [mentionedTitles]);

  useEffect(() => {
    if (watchlistMounted && tmdbId && session?.user) {
      setShowSaveCTA(!isSaved(tmdbId));
    }
  }, [watchlistMounted, tmdbId, isSaved, session]);

  const daysSinceRelease = (() => {
    if (!releaseDate) return null;
    try {
      const release = new Date(releaseDate);
      const now = new Date();
      return Math.floor((now.getTime() - release.getTime()) / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  })();

  const isEarlyVerdict = (() => {
    if (daysSinceRelease === null) return false;
    if (daysSinceRelease <= 14) return true;
    if (review.confidence === "LOW" && daysSinceRelease <= 60) return true;
    return false;
  })();

  const earlyVerdictMessage = (() => {
    if (daysSinceRelease !== null && daysSinceRelease <= 14) {
      return "This title just dropped \u2014 this is an early verdict based on initial reviews. It may change as more reviews come in.";
    }
    return "This title does not have many reviews online yet. Our AI is working with limited data, so check back later for a more informed take.";
  })();

  return (
    <div className="animate-fade-in space-y-8">
      {/* Refresh Verdict */}
      {onRefresh && (
        <div className="flex justify-end pb-2 sm:pb-4">
          <button
            onClick={onRefresh}
            className="group inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-accent-gold/70 transition-all duration-200 hover:bg-accent-gold/10 hover:text-accent-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold"
          >
            <svg
              className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh verdict</span>
          </button>
        </div>
      )}

      {/* Early Verdict Banner */}
      {isEarlyVerdict && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4 flex items-start gap-3">
          <span className="text-xl mt-0.5" aria-hidden="true">🎬</span>
          <div>
            <p className="text-sm font-bold text-amber-400">Early Verdict</p>
            <p className="text-xs text-amber-200/70 mt-0.5 leading-relaxed">
              {earlyVerdictMessage}
            </p>
          </div>
        </div>
      )}

      {/* 1. THE VIBE */}
      {review.vibe && (
        <div className="text-center px-4 pt-4">
          <p className="text-2xl md:text-3xl font-serif italic font-medium text-accent-gold leading-relaxed drop-shadow-lg">
            &ldquo;{review.vibe}&rdquo;
          </p>
        </div>
      )}

      {/* 2. VERDICT BADGE + How it works */}
      <div className="flex flex-col items-center gap-3">
        <VerdictBadge verdict={review.verdict} size="lg" />
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How is this verdict generated?
        </button>
        {showMethodology && (
          <div className="max-w-md text-center px-4 py-3 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
            <p className="text-xs text-text-secondary leading-relaxed">
              Verdicts are generated by analyzing reviews from professional critics,
              Reddit discussions, and audience scores. AI synthesizes several sources
              into a single verdict.
            </p>
          </div>
        )}
      </div>

      {/* 3. THE HOOK + Tags */}
      <div className="space-y-6 text-center">
        {review.hook && (
          <h4 className="font-display text-base md:text-lg text-white/90 tracking-wide max-w-xl mx-auto px-4">
            {review.hook}
          </h4>
        )}

        {/* Verdict DNA: Tags — properly split and displayed */}
        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2 pb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/60"
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Sentiment Bar */}
      {(review.positive_pct || review.negative_pct || review.mixed_pct) && (
        <div className="max-w-xl mx-auto px-4">
          <SentimentBar
            positive={review.positive_pct ?? null}
            mixed={review.mixed_pct ?? null}
            negative={review.negative_pct ?? null}
          />
        </div>
      )}

      {/* Main Review Text */}
      <div className="space-y-6 max-w-3xl mx-auto px-2 font-serif text-base md:text-lg leading-relaxed text-text-secondary/90 text-justify hyphens-auto">
        {paragraphs.map((para, i) => {
          const parsed = parseMovieMentions(para, resolvedMentions);
          if (i === 0 && para.length > 0) {
            const firstChar = typeof parsed[0] === "string" ? parsed[0].charAt(0) : "";
            const restOfFirst = typeof parsed[0] === "string" ? parsed[0].slice(1) : parsed[0];
            const rest = parsed.slice(1);
            return (
              <p key={i}>
                {firstChar && (
                  <span className="float-left mr-3 mt-[-4px] text-5xl sm:text-6xl font-display font-bold text-accent-gold leading-[0.8]">
                    {firstChar}
                  </span>
                )}
                {restOfFirst}
                {rest}
              </p>
            );
          }
          return (
            <p key={i}>
              {parsed}
            </p>
          );
        })}
      </div>

      {/* Praise & Criticism Grid */}
      <div className="grid gap-6 sm:grid-cols-2 pt-4">
        <div className="rounded-xl bg-verdict-worth/5 border border-verdict-worth/10 p-5 transition-colors hover:bg-verdict-worth/10">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-verdict-worth">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verdict-worth/20 text-xs">✓</span>
            The Good
          </h3>
          {review.praise_points && review.praise_points.length > 0 ? (
            <ul className="space-y-3">
              {review.praise_points.map((point, i) => (
                <li key={i} className="text-base leading-snug text-text-secondary/90">
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-base italic text-text-secondary/50">
              No standout positives noted
            </p>
          )}
        </div>

        {review.criticism_points && review.criticism_points.length > 0 && (
          <div className="rounded-xl bg-verdict-skip/5 border border-verdict-skip/10 p-5 transition-colors hover:bg-verdict-skip/10">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-verdict-skip">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verdict-skip/20 text-xs">✗</span>
              The Bad
            </h3>
            <ul className="space-y-3">
              {review.criticism_points.map((point, i) => (
                <li key={i} className="text-base leading-snug text-text-secondary/90">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Feedback */}
      {tmdbId && <ReviewFeedback tmdbId={tmdbId} />}

      {/* Save CTA — nudges users who haven't saved this movie */}
      {showSaveCTA && tmdbId && movieTitle && (
        <div className="animate-fade-in flex flex-col sm:flex-row items-center justify-center gap-3 py-5 px-5 rounded-xl border border-accent-gold/10 bg-accent-gold/[0.03]">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="text-base" aria-hidden="true">🎬</span>
            <p className="text-sm text-text-secondary">
              Like this pick? Save it to your watchlist.
            </p>
          </div>
          <BookmarkButton
            tmdb_id={tmdbId}
            title={movieTitle}
            poster_path={posterPath || null}
            verdict={review.verdict}
            variant="page"
          />
        </div>
      )}

      {/* Trailer Embed */}
      {review.trailer_url ? (
        <div id="trailer-section" className="overflow-hidden rounded-xl border border-white/10 shadow-lg mt-4">
          <TrailerEmbed youtubeUrl={review.trailer_url} />
        </div>
      ) : movieTitle && (
        <div className="mt-4 text-center">
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle + " official trailer")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-accent-gold transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff" />
            </svg>
            Search trailer on YouTube
          </a>
        </div>
      )}

    </div>
  );
}