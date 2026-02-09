"use client";

interface VerdictBadgeProps {
  verdict: string;
  size?: "sm" | "md" | "lg";
}

const VERDICT_CONFIG: Record<string, { label: string; emoji: string; className: string }> = {
  "WORTH IT": { label: "WORTH IT", emoji: "✅", className: "verdict-worth" },
  "NOT WORTH IT": { label: "NOT WORTH IT", emoji: "❌", className: "verdict-skip" },
  "MIXED BAG": { label: "MIXED BAG", emoji: "⚖️", className: "verdict-mixed" },
};

const SIZE_CLASSES = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
  lg: "px-5 py-2 text-base",
};

export default function VerdictBadge({ verdict, size = "md" }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG["MIXED BAG"];

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full font-semibold tracking-wide ${config.className} ${SIZE_CLASSES[size]}`}
    >
      <span>{config.emoji}</span>
      <span>{config.label}</span>
    </span>
  );
}
