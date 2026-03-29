"use client";

import { useState, useEffect, useRef } from "react";

interface RateLimitCardProps {
  type: string;
  message: string;
  retryAfter?: number;
  onDismiss?: () => void;
  onExpire?: () => void;
}

function ClockIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3h10.5M6.75 21h10.5M7.5 3v3.75c0 1.57.842 3.02 2.204 3.807L12 12l-2.296 1.443A4.498 4.498 0 007.5 17.25V21m9-18v3.75a4.498 4.498 0 01-2.204 3.807L12 12l2.296 1.443A4.498 4.498 0 0016.5 17.25V21" />
    </svg>
  );
}

function getVariant(type: string) {
  switch (type) {
    case "user_quota_exhausted":
      return {
        icon: <ClockIcon />,
        heading: "You've reached today's limit",
        accent: "from-accent-gold/10 to-transparent",
      };
    case "global_daily_limit":
    case "global_hourly_limit":
      return {
        icon: <FireIcon />,
        heading: "We're buzzing right now",
        accent: "from-accent-gold/10 to-transparent",
      };
    case "ip_abuse":
    case "ip_daily_limit":
      return {
        icon: <ShieldIcon />,
        heading: "Too many requests",
        accent: "from-white/5 to-transparent",
      };
    default:
      return {
        icon: <HourglassIcon />,
        heading: "Hang tight",
        accent: "from-accent-gold/10 to-transparent",
      };
  }
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  return `${s}s`;
}

export default function RateLimitCard({ type, message, retryAfter = 0, onDismiss, onExpire }: RateLimitCardProps) {
  const [remaining, setRemaining] = useState(retryAfter);
  const variant = getVariant(type);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(retryAfter);
  }, [retryAfter]);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining > 0]);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-surface-card p-6 shadow-2xl text-center animate-fade-in animate-slide-up overflow-hidden">
      {/* Gradient accent behind icon */}
      <div className={`absolute inset-0 -z-10 bg-gradient-to-b ${variant.accent} opacity-60`} />

      <div className="flex flex-col items-center gap-3">
        {/* Icon */}
        <div className="text-accent-gold">
          {variant.icon}
        </div>

        {/* Heading */}
        <h3 className="font-display text-lg text-white">
          {variant.heading}
        </h3>

        {/* Server message */}
        <p className="text-sm text-text-secondary max-w-xs">
          {message}
        </p>

        {/* Live countdown */}
        {remaining > 0 && (
          <div className="mt-1 flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 border border-white/5">
            <svg className="w-3.5 h-3.5 text-accent-gold/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-accent-gold font-mono tabular-nums">
              Ready in {formatCountdown(remaining)}
            </span>
          </div>
        )}

        {remaining <= 0 && retryAfter > 0 && (
          <p className="text-xs text-accent-gold/60 mt-1">
            You should be able to try again now
          </p>
        )}
      </div>

      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 text-text-muted transition-colors hover:text-white"
          aria-label="Dismiss"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
