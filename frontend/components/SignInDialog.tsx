"use client";

import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
  context?: string;
}

const INCENTIVES = [
  "Unlock more verdicts, battles, and spins",
  "Save movies and sync across devices",
  "Mark movies as watched or skipped",
  "Your personal review history",
  "Vote on whether verdicts are helpful",
];

export default function SignInDialog({ open, onClose, context }: SignInDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-surface-card p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted transition-colors hover:text-white"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="font-display text-xl text-white">Unlock the full experience</h2>

        {context && (
          <p className="mt-2 text-sm text-accent-gold/80">{context}</p>
        )}

        <ul className="mt-5 space-y-3">
          {INCENTIVES.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-gold"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm leading-snug text-text-secondary">{item}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => signIn("google", { callbackUrl: window.location.href })}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-gold px-6 py-3 font-bold text-black transition-colors hover:bg-accent-goldLight"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <button
          onClick={onClose}
          className="mt-4 w-full text-center text-sm text-text-secondary transition-colors hover:text-white"
        >
          Maybe later
        </button>
      </div>
    </div>,
    document.body
  );
}
