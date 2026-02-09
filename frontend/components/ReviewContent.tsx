"use client";

import type { Review } from "@/lib/api";
import VerdictBadge from "./VerdictBadge";
import SentimentBar from "./SentimentBar";

import TrailerEmbed from "./TrailerEmbed";

interface ReviewContentProps {
  review: Review;
}

export default function ReviewContent({ review }: ReviewContentProps) {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Verdict */}
      <div className="flex items-center gap-4">
        <VerdictBadge verdict={review.verdict} size="lg" />
        {review.controversial && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
            🔥 Controversial
          </span>
        )}
      </div>

      {/* Vibe */}
      {review.vibe && (
        <p className="font-display text-lg italic text-accent-gold/80">
          &ldquo;{review.vibe}&rdquo;
        </p>
      )}

      {/* Review Text */}
      <div className="prose prose-invert max-w-none">
        <p className="text-base leading-relaxed text-text-primary/90">
          {review.review_text}
        </p>
      </div>

      {/* Sentiment Bar (Phase 2) */}
      <SentimentBar
        positive={review.positive_pct}
        mixed={review.mixed_pct}
        negative={review.negative_pct}
      />

      {/* Praise & Criticism */}
      <div className="grid gap-4 sm:grid-cols-2">
        {review.praise_points && review.praise_points.length > 0 && (
          <div className="rounded-xl bg-verdict-worth/5 border border-verdict-worth/10 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-verdict-worth">
              What Works
            </h3>
            <ul className="space-y-2">
              {review.praise_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-0.5 text-verdict-worth">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {review.criticism_points && review.criticism_points.length > 0 && (
          <div className="rounded-xl bg-verdict-skip/5 border border-verdict-skip/10 p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-verdict-skip">
              What Doesn&apos;t
            </h3>
            <ul className="space-y-2">
              {review.criticism_points.map((point, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="mt-0.5 text-verdict-skip">✗</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Trailer Embed - Integrated into Review Card */}
      {review.trailer_url && (
        <div className="pt-2">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Official Trailer
          </h3>
          <div className="overflow-hidden rounded-xl border border-surface-elevated">
            <TrailerEmbed youtubeUrl={review.trailer_url} />
          </div>
        </div>
      )}

      {/* Sources & Meta */}
      <div className="flex flex-wrap items-center gap-4 border-t border-surface-elevated pt-4 text-xs text-text-muted">
        {review.generated_at && (
          <span>
            🕐 Generated{" "}
            {new Date(review.generated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
        {review.imdb_score && <span>⭐ IMDb {review.imdb_score}</span>}
        {review.rt_critic_score && <span>🍅 Critics {review.rt_critic_score}%</span>}
        {review.rt_audience_score && <span>🍿 Audience {review.rt_audience_score}%</span>}
      </div>
    </div>
  );
}
