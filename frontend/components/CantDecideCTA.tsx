"use client";

import { useState } from "react";
import CinemaRoulette from "./CinemaRoulette";

export default function CantDecideCTA() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="relative py-14 sm:py-16 flex flex-col items-center text-center rounded-2xl overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/images/movie-collage.jpg" alt="" className="w-full h-full object-cover opacity-30" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/50 to-surface" />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-accent-gold/70 mb-3">Can&apos;t Decide?</span>
          <h3 className="font-display text-3xl sm:text-4xl md:text-5xl text-white mb-3 text-shadow-hero">
            Let us pick for you.
          </h3>
          <p className="text-base sm:text-lg text-text-secondary/80 max-w-sm mb-8 text-shadow-sub">
            One tap. One movie the internet says is worth your time.
          </p>
          <button
            onClick={() => setIsOpen(true)}
            className="text-lg font-semibold text-accent-gold border-b-2 border-accent-gold/40 pb-1 hover:border-accent-gold hover:text-accent-goldLight transition-colors duration-200 active:scale-95"
          >
            Surprise me
          </button>
        </div>
      </div>
      <CinemaRoulette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
