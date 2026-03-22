"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FeedbackData {
  helpful_count: number;
  not_helpful_count: number;
  total: number;
  user_vote: boolean | null;
}

interface ReviewFeedbackProps {
  tmdbId: number;
}

export default function ReviewFeedback({ tmdbId }: ReviewFeedbackProps) {
  const { data: session } = useSession();
  const userId = session?.user?.id || null;
  const [data, setData] = useState<FeedbackData | null>(null);
  const [voted, setVoted] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  const prefersReducedMotion = useReducedMotion();
  const storageKey = `feedback_${tmdbId}`;

  const fetchFeedback = useCallback(async () => {
    try {
      const url = userId
        ? `${API_BASE}/api/reviews/${tmdbId}/feedback?user_id=${encodeURIComponent(userId)}`
        : `${API_BASE}/api/reviews/${tmdbId}/feedback`;
      const res = await fetch(url);
      if (res.ok) {
        const json: FeedbackData = await res.json();
        setData(json);
        if (json.user_vote !== null) {
          setVoted(json.user_vote);
        }
      }
    } catch {
      // Silently fail — feedback is non-critical
    }
  }, [tmdbId, userId]);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      setVoted(stored === "true");
    }
    fetchFeedback();
  }, [fetchFeedback, storageKey]);

  const submitVote = async (helpful: boolean) => {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/reviews/${tmdbId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ helpful, user_id: userId }),
      });

      if (res.ok) {
        const json: FeedbackData = await res.json();
        setData(json);
        setVoted(helpful);
        localStorage.setItem(storageKey, String(helpful));
        setShowThanks(true);
        setTimeout(() => setShowThanks(false), 2500);
      }
    } catch {
      // Silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const helpfulPct =
    data && data.total >= 10
      ? Math.round((data.helpful_count / data.total) * 100)
      : null;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <AnimatePresence mode="wait">
        {showThanks ? (
          <motion.p
            key="thanks"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            className="text-xs font-medium text-accent-gold tracking-wide"
          >
            Thanks for the feedback!
          </motion.p>
        ) : (
          <motion.p
            key="question"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs font-medium text-text-secondary/60 tracking-wide uppercase"
          >
            Was this verdict helpful?
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => submitVote(true)}
          disabled={submitting}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none ${
            submitting ? "opacity-50 cursor-not-allowed" :
            voted === true
              ? "border-verdict-worth/40 bg-verdict-worth/10 text-verdict-worth"
              : "border-white/10 bg-white/5 text-text-secondary/70 hover:border-verdict-worth/30 hover:text-verdict-worth"
          }`}
        >
          <span className="text-base" aria-hidden="true">👍</span>
          Yes
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => submitVote(false)}
          disabled={submitting}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:outline-none ${
            submitting ? "opacity-50 cursor-not-allowed" :
            voted === false
              ? "border-verdict-skip/40 bg-verdict-skip/10 text-verdict-skip"
              : "border-white/10 bg-white/5 text-text-secondary/70 hover:border-verdict-skip/30 hover:text-verdict-skip"
          }`}
        >
          <span className="text-base" aria-hidden="true">👎</span>
          No
        </motion.button>
      </div>

      {helpfulPct !== null && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] text-text-secondary/40 tracking-wide"
        >
          {helpfulPct}% found this helpful
        </motion.p>
      )}
    </div>
  );
}
