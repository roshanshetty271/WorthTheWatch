"use client";

import { useState } from "react";
import CinemaRoulette from "./CinemaRoulette";

export default function CantDecideFooterLink() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-text-secondary hover:text-accent-gold transition-colors duration-200"
      >
        Can&apos;t Decide?
      </button>
      <CinemaRoulette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
