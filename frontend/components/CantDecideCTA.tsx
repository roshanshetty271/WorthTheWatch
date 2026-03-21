"use client";

import { useState } from "react";
import CinemaRoulette from "./CinemaRoulette";

export default function CantDecideCTA() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-surface-card p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-xl text-white">
            Can&apos;t decide what to watch?
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            Let the roulette pick a movie the internet says is worth it.
          </p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="shrink-0 rounded-xl bg-accent-gold px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-accent-goldLight active:scale-95"
        >
          Surprise Me
        </button>
      </div>
      <CinemaRoulette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
