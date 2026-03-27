"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

const KEYS = {
  battleCount: "wtw_battle_count",
  rouletteCount: "wtw_roulette_count",
  lastReset: "wtw_last_reset",
} as const;

const SOFT_LIMITS = { battle: 3, roulette: 3 };

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const last = localStorage.getItem(KEYS.lastReset);
  const today = getTodayKey();
  if (last !== today) {
    localStorage.setItem(KEYS.battleCount, "0");
    localStorage.setItem(KEYS.rouletteCount, "0");
    localStorage.setItem(KEYS.lastReset, today);
  }
}

function getCount(key: string): number {
  return parseInt(localStorage.getItem(key) || "0", 10);
}

function increment(key: string): number {
  const next = getCount(key) + 1;
  localStorage.setItem(key, String(next));
  return next;
}

export function useSignInPrompt() {
  const { data: session } = useSession();
  const isSignedIn = !!session?.user;

  const [battleCount, setBattleCount] = useState(0);
  const [rouletteCount, setRouletteCount] = useState(0);

  useEffect(() => {
    resetIfNewDay();
    setBattleCount(getCount(KEYS.battleCount));
    setRouletteCount(getCount(KEYS.rouletteCount));
  }, []);

  const bypass = isSignedIn;
  const canBattle = bypass || battleCount < SOFT_LIMITS.battle;
  const canRoulette = bypass || rouletteCount < SOFT_LIMITS.roulette;

  const incrementBattle = useCallback(() => {
    resetIfNewDay();
    const next = increment(KEYS.battleCount);
    setBattleCount(next);
  }, []);

  const incrementRoulette = useCallback(() => {
    resetIfNewDay();
    const next = increment(KEYS.rouletteCount);
    setRouletteCount(next);
  }, []);

  return {
    isSignedIn,
    canBattle,
    canRoulette,
    battlesRemaining: Math.max(0, SOFT_LIMITS.battle - battleCount),
    rouletteRemaining: Math.max(0, SOFT_LIMITS.roulette - rouletteCount),
    incrementBattle,
    incrementRoulette,
  };
}
