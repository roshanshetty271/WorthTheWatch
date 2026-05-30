import type { Metadata } from "next";
import MaintenanceFeedbackForm from "./MaintenanceFeedbackForm";

export const metadata: Metadata = {
    title: "We'll be right back",
    description: "Worth the Watch? is down for scheduled maintenance and will be back online June 1.",
    robots: { index: false, follow: false },
};

export default function MaintenancePage() {
    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-surface">
            {/* Cinematic backdrop — same treatment as the homepage hero & "Can't Decide?" CTA */}
            <div className="absolute inset-0 z-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/images/cinema-bg.jpg"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-cover object-center opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-surface/85 via-surface/75 to-surface" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-16">
                {/* Logo — matches Navbar treatment */}
                <span className="font-display text-2xl md:text-3xl text-white tracking-tight text-shadow-hero">
                    Worth the <span className="text-accent-gold">Watch</span>?
                </span>

                {/* Eyebrow — cinema motif, matches the gold uppercase label used across the app */}
                <span className="mt-12 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-accent-gold/80">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />
                    Intermission
                </span>

                {/* Headline */}
                <h1 className="mt-4 text-center font-display text-4xl md:text-5xl text-white tracking-tight text-shadow-hero">
                    We&apos;ll be right back.
                </h1>
                <p className="mt-4 max-w-md text-center text-base sm:text-lg text-text-secondary/90 text-shadow-sub">
                    We&apos;re running some quick maintenance and expect to be back by{" "}
                    <span className="font-semibold text-accent-gold">June 1</span>. Thanks so much
                    for using Worth the Watch? — it genuinely means a lot. 🍿
                </p>

                {/* Feedback card — frosted surface with the app's editorial accent header */}
                <div className="mt-12 w-full rounded-2xl border border-white/10 bg-surface-card/80 p-6 backdrop-blur-md sm:p-8 animate-fade-in">
                    <div className="mb-5 border-l-4 border-accent-gold pl-3">
                        <h2 className="font-body text-lg font-bold uppercase tracking-wide text-white">
                            While you&apos;re here
                        </h2>
                        <p className="mt-1 text-sm text-text-secondary/70 normal-case">
                            Help shape what comes next — what do you love, and what should we improve?
                        </p>
                    </div>
                    <MaintenanceFeedbackForm />
                </div>

                <p className="mt-10 text-center text-xs text-text-muted">
                    © {new Date().getFullYear()} Worth the Watch? — Don&apos;t watch another bad movie.
                </p>
            </div>
        </div>
    );
}
