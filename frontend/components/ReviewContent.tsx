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
      {/* Header: Verdict & Vibe */}
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <VerdictBadge verdict={review.verdict} size="lg" />
        </div>

        {review.vibe && (
          <h3 className="font-display text-2xl italic text-accent-gold/90 drop-shadow-sm">
            &ldquo;{review.vibe}&rdquo;
          </h3>
        )}

        {/* Verdict DNA: Tags */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-accent-gold/30 transition-all cursor-default"
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Verdict DNA: Best Quote */}
      {review.best_quote && (
        <div className="relative mx-auto max-w-2xl rounded-xl border-l-4 border-accent-gold bg-accent-gold/5 p-6 shadow-sm">
          <span className="absolute -top-4 -left-2 text-6xl text-accent-gold/20 font-serif leading-none">“</span>
          <p className="relative text-lg font-medium italic text-text-primary/95 text-center leading-relaxed">
            {review.best_quote}
          </p>
          {review.quote_source && (
            <p className="mt-3 text-center text-xs font-bold uppercase tracking-widest text-accent-gold/70">
              — {review.quote_source}
            </p>
          )}
        </div>
      )}

      {/* Review Text - Readable Paragraphs */}
      <div className="prose prose-invert max-w-none">
        <div className="space-y-4 text-lg leading-relaxed text-text-primary/90 font-light">
          {paragraphs.map((para, index) => (
            <p key={index} className={index === 0 ? "first-letter:float-left first-letter:mr-3 first-letter:text-5xl first-letter:font-display first-letter:text-accent-gold first-letter:leading-none" : ""}>
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* Sentiment Bar */}
      <div className="py-2">
        <SentimentBar
          positive={review.positive_pct}
          mixed={review.mixed_pct}
          negative={review.negative_pct}
        />
      </div>

      {/* Praise & Criticism Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
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
        <div className="overflow-hidden rounded-xl border border-white/10 shadow-lg">
          <TrailerEmbed youtubeUrl={review.trailer_url} />
        </div>
      )}

      {/* Sources & Meta (No Date) */}
      <div className="flex flex-wrap items-center justify-center gap-6 border-t border-white/5 pt-6 text-xs font-medium uppercase tracking-wider text-text-muted">
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
