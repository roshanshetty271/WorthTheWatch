"use client";

interface TrailerEmbedProps {
    youtubeUrl: string;
}

/**
 * TrailerEmbed - YouTube video embed component
 * Displays a movie trailer from a YouTube embed URL.
 */
export default function TrailerEmbed({ youtubeUrl }: TrailerEmbedProps) {
    // Extract video ID if we got a full URL
    let embedUrl = youtubeUrl;

    // Handle different YouTube URL formats
    if (youtubeUrl.includes("youtube.com/watch?v=")) {
        const videoId = youtubeUrl.split("v=")[1]?.split("&")[0];
        if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }
    } else if (youtubeUrl.includes("youtu.be/")) {
        const videoId = youtubeUrl.split("youtu.be/")[1]?.split("?")[0];
        if (videoId) {
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
        }
    }

    return (
        <div className="overflow-hidden rounded-xl border border-surface-elevated bg-surface-card">
            <div className="aspect-video w-full">
                <iframe
                    src={embedUrl}
                    title="Movie Trailer"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                />
            </div>
        </div>
    );
}
