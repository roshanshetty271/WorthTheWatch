"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

const KEYS = {
  genCount: "wtw_gen_count",
  battleCount: "wtw_battle_count",
  rouletteCount: "wtw_roulette_count",
  pagesViewed: "wtw_pages_viewed",
  signupShown: "wtw_signup_shown",
  lastReset: "wtw_last_reset",
} as const;

const SOFT_LIMITS = { generation: 2, battle: 1, roulette: 1 };
const DIALOG_PAGE_THRESHOLD = 2;

const WHITELIST = (process.env.NEXT_PUBLIC_RATE_LIMIT_WHITELIST || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const last = localStorage.getItem(KEYS.lastReset);
  const today = getTodayKey();
  if (last !== today) {
    localStorage.setItem(KEYS.genCount, "0");
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

  const [shouldShowDialog, setShouldShowDialog] = useState(false);
  const [genCount, setGenCount] = useState(0);
  const [battleCount, setBattleCount] = useState(0);
  const [rouletteCount, setRouletteCount] = useState(0);
  const [whitelisted, setWhitelisted] = useState(false);

  useEffect(() => {
    resetIfNewDay();
    setGenCount(getCount(KEYS.genCount));
    setBattleCount(getCount(KEYS.battleCount));
    setRouletteCount(getCount(KEYS.rouletteCount));

    if (WHITELIST.length > 0) {
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((data) => {
          if (WHITELIST.includes(data.ip)) setWhitelisted(true);
        })
        .catch(() => {});
    }
  }, []);

  const bypass = isSignedIn || whitelisted;
  const canGenerate = bypass || genCount < SOFT_LIMITS.generation;
  const canBattle = bypass || battleCount < SOFT_LIMITS.battle;
  const canRoulette = bypass || rouletteCount < SOFT_LIMITS.roulette;

  const incrementGeneration = useCallback(() => {
    resetIfNewDay();
    const next = increment(KEYS.genCount);
    setGenCount(next);
  }, []);

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

  const incrementPageView = useCallback(() => {
    if (bypass) return;
    resetIfNewDay();
    const views = increment(KEYS.pagesViewed);
    const alreadyShown = localStorage.getItem(KEYS.signupShown) === "true";
    if (views >= DIALOG_PAGE_THRESHOLD && !alreadyShown) {
      setShouldShowDialog(true);
    }
  }, [bypass]);

  const markDialogShown = useCallback(() => {
    localStorage.setItem(KEYS.signupShown, "true");
    setShouldShowDialog(false);
  }, []);

  return {
    isSignedIn,
    shouldShowDialog,
    canGenerate,
    canBattle,
    canRoulette,
    generationsRemaining: Math.max(0, SOFT_LIMITS.generation - genCount),
    battlesRemaining: Math.max(0, SOFT_LIMITS.battle - battleCount),
    rouletteRemaining: Math.max(0, SOFT_LIMITS.roulette - rouletteCount),
    incrementGeneration,
    incrementBattle,
    incrementRoulette,
    incrementPageView,
    markDialogShown,
  };
}
