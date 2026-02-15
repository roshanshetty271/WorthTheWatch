/**
 * Worth the Watch? — Battle Share Card
 * Generates a shareable PNG image from battle results.
 * 
 * Uses html-to-image to capture a hidden card div.
 * TMDB images are proxied through /api/image-proxy to avoid CORS.
 * Mobile: native share sheet (WhatsApp, Instagram, Twitter, etc.)
 * Desktop: downloads the PNG.
 */
"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { toPng } from "html-to-image";

const TMDB_IMG = "https://image.tmdb.org/t/p/w342";

interface ShareCardProps {
    winnerTitle: string;
    loserTitle: string;
    winnerPosterPath: string | null;
    loserPosterPath: string | null;
    killReason: string;
    winnerHeadline: string;
    loserHeadline: string;
}

// ─── Proxy helper ──────────────────────────────────────
// Routes TMDB images through our Next.js API to avoid CORS
function proxyUrl(posterPath: string | null): string {
    if (!posterPath) return "";
    const tmdbUrl = posterPath.startsWith("http")
        ? posterPath
        : `${TMDB_IMG}${posterPath}`;
    return `/api/image-proxy?url=${encodeURIComponent(tmdbUrl)}`;
}

export default function BattleShareCard({
    winnerTitle,
    loserTitle,
    winnerPosterPath,
    loserPosterPath,
    killReason,
    winnerHeadline,
    loserHeadline,
}: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [imagesLoaded, setImagesLoaded] = useState(false);

    // Pre-load proxied images so they're ready when we capture
    useEffect(() => {
        const urls = [proxyUrl(winnerPosterPath), proxyUrl(loserPosterPath)].filter(Boolean);
        if (urls.length === 0) {
            setImagesLoaded(true);
            return;
        }

        let loaded = 0;
        urls.forEach((url) => {
            const img = new Image();
            img.onload = () => {
                loaded++;
                if (loaded >= urls.length) setImagesLoaded(true);
            };
            img.onerror = () => {
                loaded++;
                if (loaded >= urls.length) setImagesLoaded(true);
            };
            img.src = url;
        });
    }, [winnerPosterPath, loserPosterPath]);

    const handleShare = useCallback(async () => {
        if (!cardRef.current || !imagesLoaded) return;
        setIsGenerating(true);

        try {
            // Small delay to ensure images are painted
            await new Promise((r) => setTimeout(r, 200));

            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2, // Retina quality
                cacheBust: true,
                backgroundColor: "#0a0a0a",
            });

            // Convert data URL to blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "battle-verdict.png", { type: "image/png" });

            // Mobile: native share sheet
            if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Movie Battle Verdict",
                    text: `${winnerTitle} defeats ${loserTitle}! ⚔️🎬`,
                });
            } else {
                // Desktop: download the image
                const link = document.createElement("a");
                link.download = `${winnerTitle.replace(/\s+/g, "-")}-vs-${loserTitle.replace(/\s+/g, "-")}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (err) {
            console.error("Share failed:", err);
            // Final fallback: copy text
            try {
                const text = `🏆 ${winnerTitle} DEFEATS ${loserTitle}\n\n"${killReason}"\n\n⚔️ worth-the-watch.vercel.app/versus`;
                await navigator.clipboard.writeText(text);
                alert("Image generation failed — verdict copied to clipboard instead!");
            } catch {
                alert("Share failed. Try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    }, [imagesLoaded, winnerTitle, loserTitle, killReason]);

    return (
        <>
            {/* ═══════ HIDDEN SHARE CARD ═══════
                This div is positioned off-screen. It renders the shareable image
                layout. html-to-image captures it as a PNG when user clicks Share.
                Using regular <img> tags (NOT Next.js Image) with proxied URLs
                to avoid CORS issues.
            */}
            <div
                style={{
                    position: "fixed",
                    left: "-9999px",
                    top: "-9999px",
                    zIndex: -1,
                    pointerEvents: "none",
                }}
                aria-hidden="true"
            >
                <div
                    ref={cardRef}
                    style={{
                        width: "600px",
                        height: "800px",
                        background: "linear-gradient(180deg, #111111 0%, #0a0a0a 100%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "40px",
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        position: "relative",
                        overflow: "hidden",
                    }}
                >
                    {/* Subtle background glow */}
                    <div
                        style={{
                            position: "absolute",
                            top: "-100px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "400px",
                            height: "400px",
                            background: "radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)",
                            pointerEvents: "none",
                        }}
                    />

                    {/* Header */}
                    <div
                        style={{
                            textAlign: "center",
                            marginBottom: "30px",
                            position: "relative",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "11px",
                                fontWeight: 900,
                                letterSpacing: "4px",
                                textTransform: "uppercase",
                                color: "#d4a843",
                                marginBottom: "4px",
                            }}
                        >
                            Movie Battle
                        </div>
                        <div
                            style={{
                                fontSize: "10px",
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.25)",
                            }}
                        >
                            The Verdict Is In
                        </div>
                    </div>

                    {/* Posters row */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "20px",
                            marginBottom: "30px",
                        }}
                    >
                        {/* Winner poster */}
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width: "150px",
                                    height: "225px",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    border: "3px solid #d4a843",
                                    boxShadow: "0 0 30px rgba(212,168,67,0.2)",
                                    position: "relative",
                                    background: "#1a1a1a",
                                }}
                            >
                                {winnerPosterPath && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={proxyUrl(winnerPosterPath)}
                                        alt={winnerTitle}
                                        crossOrigin="anonymous"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                )}
                            </div>
                            <div
                                style={{
                                    marginTop: "8px",
                                    fontSize: "9px",
                                    fontWeight: 900,
                                    letterSpacing: "2px",
                                    textTransform: "uppercase",
                                    color: "#d4a843",
                                    background: "rgba(212,168,67,0.1)",
                                    border: "1px solid rgba(212,168,67,0.3)",
                                    borderRadius: "20px",
                                    padding: "4px 12px",
                                    display: "inline-block",
                                }}
                            >
                                🏆 Winner
                            </div>
                            <div
                                style={{
                                    marginTop: "6px",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    color: "#ffffff",
                                    maxWidth: "150px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {winnerTitle}
                            </div>
                            <div
                                style={{
                                    fontSize: "9px",
                                    color: "#d4a843",
                                    fontWeight: 700,
                                }}
                            >
                                {winnerHeadline}
                            </div>
                        </div>

                        {/* VS badge */}
                        <div
                            style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "50%",
                                background: "rgba(212,168,67,0.1)",
                                border: "2px solid rgba(212,168,67,0.3)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <span
                                style={{
                                    color: "#d4a843",
                                    fontWeight: 900,
                                    fontSize: "14px",
                                }}
                            >
                                VS
                            </span>
                        </div>

                        {/* Loser poster */}
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width: "150px",
                                    height: "225px",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                    border: "2px solid rgba(255,255,255,0.1)",
                                    position: "relative",
                                    background: "#1a1a1a",
                                    filter: "grayscale(70%) brightness(0.6)",
                                }}
                            >
                                {loserPosterPath && (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img
                                        src={proxyUrl(loserPosterPath)}
                                        alt={loserTitle}
                                        crossOrigin="anonymous"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                )}
                                {/* X overlay */}
                                <div
                                    style={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "rgba(0,0,0,0.3)",
                                    }}
                                >
                                    <span
                                        style={{
                                            color: "rgba(239,68,68,0.5)",
                                            fontSize: "48px",
                                            fontWeight: 900,
                                        }}
                                    >
                                        ✕
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    marginTop: "8px",
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    letterSpacing: "2px",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,0.25)",
                                }}
                            >
                                Defeated
                            </div>
                            <div
                                style={{
                                    marginTop: "6px",
                                    fontSize: "13px",
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.35)",
                                    maxWidth: "150px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {loserTitle}
                            </div>
                            <div
                                style={{
                                    fontSize: "9px",
                                    color: "rgba(255,255,255,0.2)",
                                    fontWeight: 700,
                                }}
                            >
                                {loserHeadline}
                            </div>
                        </div>
                    </div>

                    {/* Kill Reason — the star of the show */}
                    <div
                        style={{
                            background: "rgba(212,168,67,0.06)",
                            border: "1px solid rgba(212,168,67,0.15)",
                            borderRadius: "16px",
                            padding: "24px 28px",
                            maxWidth: "500px",
                            textAlign: "center",
                            marginBottom: "30px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "9px",
                                fontWeight: 900,
                                letterSpacing: "3px",
                                textTransform: "uppercase",
                                color: "#d4a843",
                                marginBottom: "10px",
                            }}
                        >
                            The Verdict
                        </div>
                        <div
                            style={{
                                fontSize: "16px",
                                fontWeight: 700,
                                fontStyle: "italic",
                                color: "#ffffff",
                                lineHeight: "1.5",
                            }}
                        >
                            &ldquo;{killReason}&rdquo;
                        </div>
                    </div>

                    {/* Watermark — FREE MARKETING */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: "20px",
                            left: 0,
                            right: 0,
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "10px",
                                fontWeight: 800,
                                letterSpacing: "2px",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.15)",
                            }}
                        >
                            Worth the Watch? · worth-the-watch.vercel.app
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ SHARE BUTTON ═══════ */}
            <button
                onClick={handleShare}
                disabled={isGenerating || !imagesLoaded}
                className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${isGenerating
                        ? "bg-accent-gold/10 text-accent-gold border-accent-gold/30 animate-pulse"
                        : "bg-surface-elevated text-white/60 hover:text-white hover:bg-white/10 border-white/10"
                    }`}
            >
                {isGenerating ? "Generating..." : "📸 Share"}
            </button>
        </>
    );
}