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

      {/* 1. THE HOOK (New) */}
      {review.hook && (
        <div className="text-center px-4">
          <p className="text-xl md:text-2xl font-serif font-medium text-white/95 leading-relaxed drop-shadow-md">
            {review.hook}
          </p>
        </div>
      )}

      {/* 2. HEADER: VERDICT & VIBE */}
      <div className="space-y-4 text-center">
        <div className="flex justify-center items-center gap-3">
          <VerdictBadge verdict={review.verdict} size="lg" />

          {/* Divided Badge if Critics/Reddit disagree */}
          {review.critic_sentiment && review.reddit_sentiment && review.critic_sentiment !== review.reddit_sentiment && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
              <span>⚡</span> Divided
            </span>
          )}
        </div>

        {review.vibe && (
          <h3 className="font-display text-lg italic text-accent-gold/80">
            &ldquo;{review.vibe}&rdquo;
          </h3>
        )}

        {/* Verdict DNA: Tags */}
        {review.tags && review.tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            {review.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-accent-gold/30 transition-all cursor-default"
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Main Review Text - RESTORED */}
      <div className="space-y-6 max-w-3xl mx-auto px-2">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-lg leading-relaxed text-text-secondary/90">
            {para}
          </p>
        ))}
      </div>

      {/* 3. CRITICS VS REDDIT (Premium Glass Cards) */}
      {(review.critic_sentiment || review.reddit_sentiment) && (
        <div className="grid grid-cols-2 gap-4 max-w-3xl mx-auto">
          {/* Critics Box */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-surface-elevated/30 p-6 text-center shadow-lg backdrop-blur-md transition-all hover:bg-surface-elevated/40">
            {/* Subtle gradient based on sentiment */}
            <div className={`absolute inset-0 opacity-10 ${review.critic_sentiment === "positive" ? "bg-gradient-to-br from-emerald-500 to-transparent" :
              review.critic_sentiment === "negative" ? "bg-gradient-to-br from-red-500 to-transparent" :
                "bg-gradient-to-br from-amber-500 to-transparent"
              }`} />

            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Critics</span>
              <span className={`text-2xl font-display ${review.critic_sentiment === "positive" ? "text-emerald-400" :
                review.critic_sentiment === "negative" ? "text-red-400" :
                  "text-amber-400"
                }`}>
                {review.critic_sentiment === "positive" ? "Loved It" :
                  review.critic_sentiment === "negative" ? "Panned It" :
                    "Mixed"}
              </span>
            </div>
          </div>

          {/* Reddit Box */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-surface-elevated/30 p-6 text-center shadow-lg backdrop-blur-md transition-all hover:bg-surface-elevated/40">
            {/* Subtle gradient based on sentiment */}
            <div className={`absolute inset-0 opacity-10 ${review.reddit_sentiment === "positive" ? "bg-gradient-to-br from-emerald-500 to-transparent" :
              review.reddit_sentiment === "negative" ? "bg-gradient-to-br from-red-500 to-transparent" :
                "bg-gradient-to-br from-amber-500 to-transparent"
              }`} />

            <div className="relative z-10 flex flex-col items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Reddit</span>
              <span className={`text-2xl font-display ${review.reddit_sentiment === "positive" ? "text-emerald-400" :
                review.reddit_sentiment === "negative" ? "text-red-400" :
                  "text-amber-400"
                }`}>
                {review.reddit_sentiment === "positive" ? "Loved It" :
                  review.reddit_sentiment === "negative" ? "Hated It" :
                    "Divided"}
              </span>
            </div>
          </div>
        </div>
      )}

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
