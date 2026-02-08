"use client";

interface SentimentBarProps {
    positive: number | null;
    mixed: number | null;
    negative: number | null;
}

/**
 * SentimentBar - Visual sentiment breakdown
 * Shows a horizontal stacked bar with positive/mixed/negative percentages.
 */
export default function SentimentBar({
    positive,
    mixed,
    negative,
}: SentimentBarProps) {
    // If we don't have sentiment data, don't render
    if (positive === null && mixed === null && negative === null) {
        return null;
    }

    // Use defaults if any value is null
    const pos = positive ?? 0;
    const mix = mixed ?? 0;
    const neg = negative ?? 0;

    // Don't render if all zeros
    if (pos === 0 && mix === 0 && neg === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Review Breakdown</span>
                <div className="flex items-center gap-4">
                    {pos > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-verdict-worth"></span>
                            {pos}% positive
                        </span>
                    )}
                    {mix > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-verdict-mixed"></span>
                            {mix}% mixed
                        </span>
                    )}
                    {neg > 0 && (
                        <span className="flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-verdict-skip"></span>
                            {neg}% negative
                        </span>
                    )}
                </div>
            </div>

            <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                {pos > 0 && (
                    <div
                        className="bg-verdict-worth transition-all duration-500"
                        style={{ width: `${pos}%` }}
                    />
                )}
                {mix > 0 && (
                    <div
                        className="bg-verdict-mixed transition-all duration-500"
                        style={{ width: `${mix}%` }}
                    />
                )}
                {neg > 0 && (
                    <div
                        className="bg-verdict-skip transition-all duration-500"
                        style={{ width: `${neg}%` }}
                    />
                )}
            </div>
        </div>
    );
}
