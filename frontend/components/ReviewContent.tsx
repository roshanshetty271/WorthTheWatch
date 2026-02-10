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
          {review.critics_agree_with_reddit === false && (
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

      {/* 3. CRITICS VS REDDIT (New) */}
      {(review.critic_sentiment || review.reddit_sentiment) && (
        <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Critics Box */}
          <div className={`rounded-xl p-4 text-center border backdrop-blur-sm transition-all ${review.critic_sentiment === "positive" ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]" :
              review.critic_sentiment === "negative" ? "bg-red-500/10 border-red-500/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.2)]" :
                "bg-amber-500/10 border-amber-500/20"
            }`}>
            <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">📰 Critics</div>
            <div className={`text-lg md:text-xl font-bold ${review.critic_sentiment === "positive" ? "text-emerald-400" :
                review.critic_sentiment === "negative" ? "text-red-400" :
                  "text-amber-400"
              }`}>
              {review.critic_sentiment === "positive" ? "👍 Loved It" :
                review.critic_sentiment === "negative" ? "👎 Panned It" :
                  "🤷 Mixed"}
            </div>
          </div>

          {/* Reddit Box */}
          <div className={`rounded-xl p-4 text-center border backdrop-blur-sm transition-all ${review.reddit_sentiment === "positive" ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_-5px_rgba(16,185,129,0.2)]" :
              review.reddit_sentiment === "negative" ? "bg-red-500/10 border-red-500/20 shadow-[0_0_15px_-5px_rgba(239,68,68,0.2)]" :
                "bg-amber-500/10 border-amber-500/20"
            }`}>
            <div className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">💬 Reddit</div>
            <div className={`text-lg md:text-xl font-bold ${review.reddit_sentiment === "positive" ? "text-emerald-400" :
                review.reddit_sentiment === "negative" ? "text-red-400" :
                  "text-amber-400"
              }`}>
              {review.reddit_sentiment === "positive" ? "👍 Loved It" :
                review.reddit_sentiment === "negative" ? "👎 Hated It" :
                  "🤷 Divided"}
            </div>
          </div>
        </div>
      )}

      {/* Tension Point */}
      {review.tension_point && (
        <div className="text-center px-6">
          <p className="text-sm md:text-base text-white/60 italic">
            {review.critics_agree_with_reddit ? "🤝" : "⚡"} {review.tension_point}
          </p>
        </div>
      )}


      {/* 4. VERDICT DNA: BEST QUOTE */}
      {review.best_quote && (
        <div className="relative mx-auto max-w-2xl rounded-xl border-l-4 border-accent-gold bg-accent-gold/5 p-6 shadow-sm mt-6">
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

      {/* 5. REVIEW TEXT */}
      <div className="prose prose-invert max-w-none pt-4">
        <div className="space-y-4 text-lg leading-relaxed text-text-primary/90 font-light">
          {paragraphs.map((para, index) => (
            <p key={index} className={index === 0 ? "first-letter:float-left first-letter:mr-3 first-letter:text-5xl first-letter:font-display first-letter:text-accent-gold first-letter:leading-none" : ""}>
              {para}
            </p>
          ))}
        </div>
      </div>

      {/* 6. WHO SHOULD WATCH / SKIP (New) */}
      {(review.who_should_watch || review.who_should_skip) && (
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          {review.who_should_watch && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
              <div className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <span>🎯</span> Who Should Watch
              </div>
              <div className="text-sm md:text-base text-gray-300 leading-snug">
                {review.who_should_watch}
              </div>
            </div>
          )}
          {review.who_should_skip && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <div className="text-xs text-red-500 font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                <span>⏭️</span> Who Should Skip
              </div>
              <div className="text-sm md:text-base text-gray-300 leading-snug">
                {review.who_should_skip}
              </div>
            </div>
          )}
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
