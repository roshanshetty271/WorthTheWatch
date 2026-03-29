"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FilmographyItem {
  tmdb_id: number;
  title: string;
  media_type: string;
  poster_url: string;
  release_date: string;
  character: string;
  vote_average: number;
  has_review?: boolean;
  verdict?: string | null;
}

interface PersonData {
  id: number;
  name: string;
  profile_url: string | null;
  filmography: FilmographyItem[];
}

const VERDICT_STYLES: Record<string, { borderColor: string; textColor: string; bgColor: string; label: string }> = {
  "WORTH IT": { borderColor: "border-emerald-500/50", textColor: "text-emerald-200", bgColor: "bg-emerald-500/30", label: "Worth It" },
  "NOT WORTH IT": { borderColor: "border-rose-500/50", textColor: "text-rose-200", bgColor: "bg-rose-500/30", label: "Skip" },
  "MIXED BAG": { borderColor: "border-amber-500/50", textColor: "text-amber-200", bgColor: "bg-amber-500/30", label: "Mixed" },
};

interface ActorModalProps {
  open: boolean;
  onClose: () => void;
  personId: number | null;
  actorName: string;
  actorImage: string | null;
  excludeTmdbId?: number;
  cache: Map<number, PersonData>;
  onCacheUpdate: (id: number, data: PersonData) => void;
}

export default function ActorModal({
  open,
  onClose,
  personId,
  actorName,
  actorImage,
  excludeTmdbId,
  cache,
  onCacheUpdate,
}: ActorModalProps) {
  const [data, setData] = useState<PersonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !personId) return;

    // Check cache first
    const cached = cache.get(personId);
    if (cached) {
      setData(cached);
      return;
    }

    setLoading(true);
    const excludeParam = excludeTmdbId ? `?exclude_tmdb_id=${excludeTmdbId}` : "";
    fetch(`${API_BASE}/api/movies/person/${personId}${excludeParam}`)
      .then((res) => res.json())
      .then((personData: PersonData) => {
        setData(personData);
        onCacheUpdate(personId, personData);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, personId, excludeTmdbId, cache, onCacheUpdate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open || !mounted || !personId) return null;

  const filmography = data?.filmography || [];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] rounded-t-2xl sm:rounded-2xl border border-white/10 bg-surface-card shadow-2xl flex flex-col overflow-hidden sm:mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-5 border-b border-white/5 shrink-0">
          <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/10 shrink-0 ring-2 ring-accent-gold/30">
            {actorImage ? (
              <Image
                src={actorImage}
                alt={actorName}
                fill
                className="object-cover"
                sizes="56px"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg text-white/40">
                {actorName.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-lg text-white truncate">{actorName}</h3>
            <p className="text-xs text-white/40">
              {loading ? "Loading filmography..." : `${filmography.length} movie${filmography.length !== 1 ? "s" : ""} & shows`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-white/40 hover:text-white transition-colors shrink-0"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-5 flex-1">
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[2/3] rounded-lg bg-white/5" />
                  <div className="mt-2 h-3 bg-white/5 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : filmography.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {filmography.map((item) => (
                <Link
                  key={`${item.tmdb_id}-${item.media_type}`}
                  href={`/movie/${item.tmdb_id}?type=${item.media_type}`}
                  onClick={onClose}
                  className="group"
                >
                  <div className={`relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 border transition-all group-hover:border-accent-gold/40 group-hover:scale-[1.03] ${
                    item.verdict && VERDICT_STYLES[item.verdict]
                      ? VERDICT_STYLES[item.verdict].borderColor
                      : "border-white/10"
                  }`}>
                    <Image
                      src={item.poster_url}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="150px"
                      unoptimized
                    />
                    {/* Verdict badge */}
                    {item.verdict && VERDICT_STYLES[item.verdict] && (
                      <div className="absolute top-1.5 left-1.5 z-10">
                        <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 px-1.5 py-0.5 backdrop-blur-md ${VERDICT_STYLES[item.verdict!].borderColor} ${VERDICT_STYLES[item.verdict!].bgColor}`}>
                          <span className={`h-1 w-1 rounded-full ${VERDICT_STYLES[item.verdict!].textColor.replace("text-", "bg-")}`} />
                          <span className={`text-[8px] font-bold uppercase tracking-wider ${VERDICT_STYLES[item.verdict!].textColor}`}>
                            {VERDICT_STYLES[item.verdict!].label}
                          </span>
                        </span>
                      </div>
                    )}
                    {/* Rating */}
                    {item.vote_average > 0 && (
                      <div className="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[9px] font-bold text-accent-gold z-10">
                        {item.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-white/70 truncate group-hover:text-white transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[9px] text-white/30">
                    {item.character && <span>{item.character} · </span>}
                    {item.release_date ? new Date(item.release_date).getFullYear() : ""}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">🎬</p>
              <p className="text-sm text-white/40">This is their only credit so far.</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
