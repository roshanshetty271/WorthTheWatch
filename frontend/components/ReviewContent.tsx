"use client";

import type { Review } from "@/lib/api";
import VerdictBadge from "./VerdictBadge";
import SentimentBar from "./SentimentBar";
import TrailerEmbed from "./TrailerEmbed";

interface ReviewContentProps {
  review: Review;
}

// Helper to format review text into readable paragraphs
const formatReviewText = (text: string) => {
  if (!text) return [];
  // If the text already has double newlines, use them
  if (text.includes('\n\n')) {
    return text.split('\n\n').filter(Boolean);
  }

  // Otherwise, split by sentences and chunk every ~3-4 sentences
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (!sentences) return [text];

  const paragraphs: string[] = [];
  let currentPara = "";

  sentences.forEach((sentence) => {
    currentPara += sentence;
    // Break if paragraph gets long enough (approx 250-300 chars)
    if (currentPara.length > 250) {
      paragraphs.push(currentPara.trim());
      currentPara = "";
    }
  });

  if (currentPara.trim()) {
    paragraphs.push(currentPara.trim());
  }

  return paragraphs;
};

export default function ReviewContent({ review }: ReviewContentProps) {
  const paragraphs = formatReviewText(review.review_text);

  return (
    <div className="animate-fade-in space-y-8">
      {/* 1. THE VIBE - Now at the Top, Golden, Serif, Large, with Quotes */}
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

      {/* 3. THE HOOK - Now at the Bottom, White, Sans-serif, No Quotes */}
      <div className="space-y-6 text-center">
        {review.hook && (
          <h4 className="font-display text-base md:text-lg text-white/90 tracking-wide max-w-xl mx-auto px-4">
            {review.hook}
          </h4>
        )}

        {/* Verdict DNA: Tags */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2 pb-4">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:border-accent-gold/30 transition-all cursor-default"
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Review Text - RESTORED */}
      <div className="space-y-6 max-w-3xl mx-auto px-2 font-serif text-lg leading-relaxed text-text-secondary/90">
        {paragraphs.map((para, i) => (
          <p
            key={i}
            className={i === 0 ? "first-letter:float-left first-letter:text-6xl first-letter:font-display first-letter:font-bold first-letter:text-accent-gold first-letter:mr-3 first-letter:mt-2 first-letter:leading-none" : ""}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Praise & Criticism Grid */}
      <div className="grid gap-6 sm:grid-cols-2 pt-4">
        {/* Praise */}
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

        {/* Criticism */}
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
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-white/5 pt-8 text-xs font-medium uppercase tracking-wider text-text-muted">
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
