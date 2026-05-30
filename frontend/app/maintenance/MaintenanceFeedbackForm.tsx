"use client";

import { useState } from "react";

export default function MaintenanceFeedbackForm() {
    const [email, setEmail] = useState("");
    const [loved, setLoved] = useState("");
    const [improve, setImprove] = useState("");
    const [company, setCompany] = useState(""); // honeypot
    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const canSubmit = loved.trim().length > 0 || improve.trim().length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setStatus("sending");
        setErrorMsg("");

        try {
            const res = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    loved: loved.trim(),
                    improve: improve.trim(),
                    company: company.trim(),
                }),
            });
            const data = await res.json();

            if (data.ok) {
                setStatus("success");
            } else {
                setStatus("error");
                setErrorMsg(
                    data.error === "validation"
                        ? "Please fill in at least one box (and a valid email if you add one)."
                        : "Something went wrong. Please try again."
                );
            }
        } catch {
            setStatus("error");
            setErrorMsg("Something went wrong. Please try again.");
        }
    };

    if (status === "success") {
        return (
            <div className="text-center py-10 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-gold/10 mb-4">
                    <svg className="w-8 h-8 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="font-display text-xl text-white mb-2">Thanks for the feedback! 💛</h2>
                <p className="text-sm text-white/50">
                    We read every note. See you when we&apos;re back online.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5 text-left">
            {/* Honeypot — hidden from humans, catches bots */}
            <div className="hidden" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input
                    id="company"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                />
            </div>

            <div>
                <label htmlFor="fb-email" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Email <span className="text-white/25 normal-case tracking-normal">(optional, if you want a reply)</span>
                </label>
                <input
                    id="fb-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={200}
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors"
                />
            </div>

            <div>
                <label htmlFor="fb-loved" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    💛 What do you love about Worth the Watch?
                </label>
                <textarea
                    id="fb-loved"
                    value={loved}
                    onChange={(e) => setLoved(e.target.value)}
                    maxLength={5000}
                    rows={3}
                    placeholder="The honest verdicts? Cinema Roulette? Tell us what clicks."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors resize-none"
                />
            </div>

            <div>
                <label htmlFor="fb-improve" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    💡 What would you improve, or want to see next?
                </label>
                <textarea
                    id="fb-improve"
                    value={improve}
                    onChange={(e) => setImprove(e.target.value)}
                    maxLength={5000}
                    rows={3}
                    placeholder="New features, fixes, titles you wish we covered — anything."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors resize-none"
                />
            </div>

            {status === "error" && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {errorMsg}
                </div>
            )}

            <button
                type="submit"
                disabled={status === "sending" || !canSubmit}
                className="w-full py-3 rounded-xl bg-accent-gold text-black font-bold text-sm uppercase tracking-wider shadow-lg shadow-accent-gold/20 hover:brightness-110 hover:shadow-accent-gold/40 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
                {status === "sending" ? "Sending..." : "Send Feedback"}
            </button>
        </form>
    );
}
