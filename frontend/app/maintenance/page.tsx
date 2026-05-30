import type { Metadata } from "next";
import MaintenanceFeedbackForm from "./MaintenanceFeedbackForm";

export const metadata: Metadata = {
    title: "We'll be right back",
    description: "Worth the Watch? is down for scheduled maintenance and will be back online June 1.",
    robots: { index: false, follow: false },
};

export default function MaintenancePage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-surface">
            {/* Ambient gold glow — subtle, on-brand */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(251,191,36,0.10) 0%, transparent 70%)",
                }}
            />

            <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-16">
                {/* Logo — matches Navbar treatment */}
                <span className="font-display text-2xl md:text-3xl text-white tracking-tight">
                    Worth the <span className="text-accent-gold">Watch</span>?
                </span>

                {/* Status pill */}
                <span className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/60">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />
                    Under Maintenance
                </span>

                {/* Headline */}
                <h1 className="mt-5 text-center font-display text-3xl md:text-4xl text-white tracking-tight">
                    We&apos;ll be right back.
                </h1>
                <p className="mt-3 max-w-md text-center text-base text-text-secondary">
                    We&apos;re doing some quick maintenance and expect to be back online by{" "}
                    <span className="font-semibold text-accent-gold">June 1</span>. Thanks so much for
                    using Worth the Watch? — it genuinely means a lot. 🍿
                </p>

                {/* Feedback card — matches homepage empty-state card styling */}
                <div className="mt-10 w-full rounded-2xl border border-surface-elevated bg-surface-card p-6 sm:p-8 animate-fade-in">
                    <h2 className="font-display text-xl text-white">While you&apos;re here…</h2>
                    <p className="mt-1 mb-6 text-sm text-white/50">
                        Help shape what comes next. What do you love, and what should we improve?
                    </p>
                    <MaintenanceFeedbackForm />
                </div>

                <p className="mt-8 text-center text-xs text-text-muted">
                    © {new Date().getFullYear()} Worth the Watch? — Don&apos;t watch another bad movie.
                </p>
            </div>
        </div>
    );
}
