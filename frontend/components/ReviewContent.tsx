"use client";

import type { Review } from "@/lib/api";
import VerdictBadge from "./VerdictBadge";
import SentimentBar from "./SentimentBar";
import TrailerEmbed from "./TrailerEmbed";

interface ReviewContentProps {
  review: Review;
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

export default function ReviewContent({ review }: ReviewContentProps) {
  const paragraphs = formatReviewText(review.review_text);
  const tags = fixTags(review.tags);

  return (
    <div className="animate-fade-in space-y-8">
      {/* 1. THE VIBE */}
      {review.vibe && (
        <div className="text-center px-4 pt-4">
          <p className="text-2xl md:text-3xl font-serif italic font-medium text-accent-gold leading-relaxed drop-shadow-lg">
            &ldquo;{review.vibe}&rdquo;
          </p>
        </div>
      )}

      {/* 2. VERDICT BADGE */}
      <div className="flex justify-center items-center">
        <VerdictBadge verdict={review.verdict} size="lg" />
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
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:border-accent-gold/30 transition-all cursor-default"
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
      <div className="space-y-6 max-w-3xl mx-auto px-2 font-serif text-lg leading-relaxed text-text-secondary/90">
        {paragraphs.map((para, i) => {
          if (i === 0 && para.length > 0) {
            const firstLetter = para.charAt(0);
            const restOfText = para.slice(1);
            return (
              <p key={i} className="relative pl-16 sm:pl-20">
                <span className="absolute left-0 top-1 w-12 sm:w-16 flex justify-center text-6xl font-display font-bold text-accent-gold leading-none select-none">
                  {firstLetter}
                </span>
                {restOfText}
              </p>
            );
          }
          return (
            <p key={i} className="pl-16 sm:pl-20">
              {para}
            </p>
          );
        })}
      </div>

      {/* Praise & Criticism Grid */}
      <div className="grid gap-6 sm:grid-cols-2 pt-4">
        {review.praise_points && review.praise_points.length > 0 && (
          <div className="rounded-xl bg-verdict-worth/5 border border-verdict-worth/10 p-5 transition-colors hover:bg-verdict-worth/10">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-verdict-worth">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-verdict-worth/20 text-xs">✓</span>
              The Good
            </h3>
            <ul className="space-y-3">
              {review.praise_points.map((point, i) => (
                <li key={i} className="text-base leading-snug text-text-secondary/90">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

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

      {/* Trailer Embed */}
      {review.trailer_url && (
        <div className="overflow-hidden rounded-xl border border-white/10 shadow-lg mt-4">
          <TrailerEmbed youtubeUrl={review.trailer_url} />
        </div>
      )}

      {/* Sources & Meta */}
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-white/5 pt-8 text-xs font-medium uppercase tracking-wider text-text-secondary">
        {review.imdb_score && (
          <span className="flex items-center gap-1.5 hover:text-accent-gold transition-colors">
            <span className="text-lg">⭐</span> IMDb {review.imdb_score}
          </span>
        )}
        {review.rt_critic_score && (
          <span className="flex items-center gap-1.5 hover:text-accent-gold transition-colors">
            <span className="text-lg">🍅</span> Critics {review.rt_critic_score}%
          </span>
        )}
        {review.rt_audience_score && (
          <span className="flex items-center gap-1.5 hover:text-accent-gold transition-colors">
            <span className="text-lg">🍿</span> Audience {review.rt_audience_score}%
          </span>
        )}
      </div>
    </div>
  );
}