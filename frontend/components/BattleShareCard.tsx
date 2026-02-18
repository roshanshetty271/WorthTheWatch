/**
 * Worth the Watch? — Battle Share Card
 * Generates a shareable PNG image from battle results.
 *
 * Uses html-to-image to capture a hidden card div.
 * TMDB images are fetched as base64 via /api/image-proxy to avoid CORS.
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

// ─── Convert image to base64 via proxy ─────────────
async function fetchAsBase64(posterPath: string | null): Promise<string> {
    if (!posterPath) return "";
    const tmdbUrl = posterPath.startsWith("http")
        ? posterPath
        : `${TMDB_IMG}${posterPath}`;
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(tmdbUrl)}`;
    try {
        const res = await fetch(proxyUrl);
        if (!res.ok) return "";
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
        });
    } catch {
        return "";
    }
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
    const [winnerBase64, setWinnerBase64] = useState<string>("");
    const [loserBase64, setLoserBase64] = useState<string>("");

    // Pre-convert poster images to base64 on mount
    // This bypasses ALL CORS and image loading issues on mobile
    useEffect(() => {
        let cancelled = false;
        async function loadImages() {
            const [w, l] = await Promise.all([
                fetchAsBase64(winnerPosterPath),
                fetchAsBase64(loserPosterPath),
            ]);
            if (!cancelled) {
                setWinnerBase64(w);
                setLoserBase64(l);
                setImagesLoaded(true);
            }
        }
        loadImages();
        return () => {
            cancelled = true;
        };
    }, [winnerPosterPath, loserPosterPath]);

    const handleShare = useCallback(async () => {
        if (!cardRef.current || !imagesLoaded) return;
        setIsGenerating(true);

        try {
            // Wait for any pending paints
            await new Promise((r) => setTimeout(r, 300));

            // Warm-up call (fixes iOS Safari first-render bug)
            try {
                await toPng(cardRef.current, {
                    pixelRatio: 1,
                    cacheBust: true,
                    backgroundColor: "#0a0a0a",
                });
            } catch {
                // Expected to fail on first attempt on some browsers
            }

            await new Promise((r) => setTimeout(r, 200));

            // Actual capture at full quality
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: "#0a0a0a",
                skipAutoScale: true,
            });

            // Convert data URL to blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], "battle-verdict.png", {
                type: "image/png",
            });

            // Strictly check for Mobile OS to avoid triggering share sheet on Windows/Mac with touchscreens
            const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

            // Mobile: use native share sheet if available
            if (
                isMobile &&
                typeof navigator !== "undefined" &&
                navigator.share &&
                navigator.canShare?.({ files: [file] })
            ) {
                await navigator.share({
                    files: [file],
                    title: "Movie Battle Verdict",
                    text: `${winnerTitle} defeats ${loserTitle}! ⚔️🎬`,
                });
            } else {
                // Desktop (or if share not supported): download the image
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
                alert(
                    "Image generation failed — verdict copied to clipboard instead!"
                );
            } catch {
                alert("Share failed. Try again.");
            }
        } finally {
            setIsGenerating(false);
        }
    }, [imagesLoaded, winnerTitle, loserTitle, killReason]);

    return (
        <>
            {/* ═══════ HIDDEN SHARE CARD ═══════ */}
            {/* 
                NOTE: We cannot use display:none or visibility:hidden because html-to-image needs it rendered.
                We cannot use left:-9999px because mobile browsers may not paint off-screen content.
                Solution: Fixed position, 0 opacity, pointer-events-none, but "on screen".
            */}
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: -50, // Behind everything
                    pointerEvents: "none",
                    visibility: "visible", // Ensure it's painted
                    opacity: 1, // Ensure it's painted
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
                aria-hidden="true"
            >
                <div
                    ref={cardRef}
                    style={{
                        width: "800px",
                        height: "1000px",
                        background:
                            "linear-gradient(180deg, #111111 0%, #0a0a0a 100%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "40px",
                        fontFamily:
                            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
                            background:
                                "radial-gradient(circle, rgba(212,168,67,0.08) 0%, transparent 70%)",
                            pointerEvents: "none",
                        }}
                    />

                    {/* Header */}
                    <div
                        style={{
                            textAlign: "center",
                            marginBottom: "40px",
                            position: "relative",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "18px",
                                fontWeight: 900,
                                letterSpacing: "6px",
                                textTransform: "uppercase",
                                color: "#d4a843",
                                marginBottom: "8px",
                            }}
                        >
                            Movie Battle
                        </div>
                        <div
                            style={{
                                fontSize: "14px",
                                letterSpacing: "4px",
                                textTransform: "uppercase",
                                color: "rgba(255,255,255,0.3)",
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
                            gap: "40px",
                            marginBottom: "50px",
                        }}
                    >
                        {/* Winner poster */}
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width: "240px",
                                    height: "360px",
                                    borderRadius: "18px",
                                    overflow: "hidden",
                                    border: "5px solid #d4a843",
                                    boxShadow:
                                        "0 0 50px rgba(212,168,67,0.3)",
                                    position: "relative",
                                    background: "#1a1a1a",
                                }}
                            >
                                {winnerBase64 && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={winnerBase64}
                                        alt={winnerTitle}
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
                                    marginTop: "16px",
                                    fontSize: "13px",
                                    fontWeight: 900,
                                    letterSpacing: "3px",
                                    textTransform: "uppercase",
                                    color: "#d4a843",
                                    background: "rgba(212,168,67,0.1)",
                                    border: "1px solid rgba(212,168,67,0.3)",
                                    borderRadius: "30px",
                                    padding: "8px 24px",
                                    display: "inline-block",
                                }}
                            >
                                Winner
                            </div>
                            <div
                                style={{
                                    marginTop: "10px",
                                    fontSize: "20px",
                                    fontWeight: 800,
                                    color: "#ffffff",
                                    maxWidth: "240px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {winnerTitle}
                            </div>
                            <div
                                style={{
                                    fontSize: "13px",
                                    color: "#d4a843",
                                    fontWeight: 700,
                                    marginTop: "4px",
                                }}
                            >
                                {winnerHeadline}
                            </div>
                        </div>

                        {/* VS badge */}
                        <div
                            style={{
                                width: "80px",
                                height: "80px",
                                borderRadius: "50%",
                                background: "rgba(212,168,67,0.1)",
                                border: "3px solid rgba(212,168,67,0.3)",
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
                                    fontSize: "24px",
                                }}
                            >
                                VS
                            </span>
                        </div>

                        {/* Loser poster */}
                        <div style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    width: "240px",
                                    height: "360px",
                                    borderRadius: "18px",
                                    overflow: "hidden",
                                    border: "3px solid rgba(255,255,255,0.1)",
                                    position: "relative",
                                    background: "#1a1a1a",
                                    filter: "grayscale(70%) brightness(0.6)",
                                }}
                            >
                                {loserBase64 && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={loserBase64}
                                        alt={loserTitle}
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
                                            fontSize: "80px",
                                            fontWeight: 900,
                                        }}
                                    >
                                        ✕
                                    </span>
                                </div>
                            </div>
                            <div
                                style={{
                                    marginTop: "16px",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    letterSpacing: "3px",
                                    textTransform: "uppercase",
                                    color: "rgba(255,255,255,0.25)",
                                }}
                            >
                                Defeated
                            </div>
                            <div
                                style={{
                                    marginTop: "10px",
                                    fontSize: "20px",
                                    fontWeight: 800,
                                    color: "rgba(255,255,255,0.35)",
                                    maxWidth: "240px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {loserTitle}
                            </div>
                            <div
                                style={{
                                    fontSize: "13px",
                                    color: "rgba(255,255,255,0.2)",
                                    fontWeight: 700,
                                    marginTop: "4px",
                                }}
                            >
                                {loserHeadline}
                            </div>
                        </div>
                    </div>

                    {/* Kill Reason */}
                    <div
                        style={{
                            background: "rgba(212,168,67,0.08)",
                            border: "1px solid rgba(212,168,67,0.2)",
                            borderRadius: "24px",
                            padding: "36px 48px",
                            maxWidth: "700px",
                            textAlign: "center",
                            marginBottom: "30px", // Reduced bottom margin
                        }}
                    >
                        <div
                            style={{
                                fontSize: "12px",
                                fontWeight: 900,
                                letterSpacing: "4px",
                                textTransform: "uppercase",
                                color: "#d4a843",
                                marginBottom: "14px",
                            }}
                        >
                            The Verdict
                        </div>
                        <div
                            style={{
                                fontSize: "26px",
                                fontWeight: 700,
                                fontStyle: "italic",
                                color: "#ffffff",
                                lineHeight: "1.5",
                            }}
                        >
                            &ldquo;{killReason}&rdquo;
                        </div>
                    </div>

                    {/* Watermark */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: "30px", // Increased bottom padding
                            left: 0,
                            right: 0,
                            textAlign: "center",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "15px", // Increased from 10px
                                fontWeight: 900,
                                letterSpacing: "3px", // Increased letter spacing
                                textTransform: "uppercase",
                                color: "#d4a843", // Changed from faint white to Gold
                                textShadow: "0 2px 10px rgba(0,0,0,0.5)", // Added shadow for readability
                            }}
                        >
                            worth-the-watch.vercel.app
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