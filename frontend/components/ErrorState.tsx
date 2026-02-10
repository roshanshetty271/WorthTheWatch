"use client";

interface ErrorStateProps {
    icon?: string;
    title: string;
    message: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    suggestion?: string;
}

export default function ErrorState({ icon = "⚠️", title, message, action, suggestion }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <div className="mb-4 text-4xl">{icon}</div>
            <h3 className="mb-2 text-lg font-bold text-white">{title}</h3>
            <p className="mb-6 max-w-sm text-sm text-text-muted">{message}</p>

            {action && (
                <button
                    onClick={action.onClick}
                    className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
                >
                    {action.label}
                </button>
            )}

            {suggestion && (
                <div className="mt-8 rounded-lg bg-surface-elevated px-4 py-3 text-xs text-text-secondary border border-white/5">
                    <span className="font-bold text-accent-gold">Suggestion:</span> {suggestion}
                </div>
            )}
        </div>
    );
}
