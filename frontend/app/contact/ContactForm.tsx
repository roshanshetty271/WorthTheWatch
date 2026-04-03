"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

function ContactFormInner({ defaultName, defaultEmail }: { defaultName: string; defaultEmail: string }) {
    const [name, setName] = useState(defaultName);
    const [email, setEmail] = useState(defaultEmail);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !message.trim()) return;

        setStatus("sending");
        setErrorMsg("");

        try {
            const res = await fetch("/api/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
            });
            const data = await res.json();

            if (data.ok) {
                setStatus("success");
                setMessage("");
            } else {
                setStatus("error");
                setErrorMsg(
                    data.error === "rate_limited"
                        ? "You've sent too many messages today. Please try again tomorrow."
                        : data.error === "validation"
                            ? "Please fill in a valid email and message."
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
            <div className="text-center py-12 animate-fade-in">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-gold/10 mb-4">
                    <svg className="w-8 h-8 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="font-display text-xl text-white mb-2">Message sent</h2>
                <p className="text-sm text-white/50 mb-6">We&apos;ll get back to you as soon as we can.</p>
                <button
                    onClick={() => setStatus("idle")}
                    className="text-sm text-accent-gold hover:text-accent-gold/80 transition-colors"
                >
                    Send another message
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Name <span className="text-accent-gold">*</span>
                </label>
                <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={200}
                    required
                    placeholder="Your name"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors"
                />
            </div>

            <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Email <span className="text-accent-gold">*</span>
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={200}
                    required
                    placeholder="your@email.com"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors"
                />
            </div>

            <div>
                <label htmlFor="message" className="block text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Message <span className="text-accent-gold">*</span>
                </label>
                <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={5000}
                    required
                    rows={5}
                    placeholder="What's on your mind?"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 transition-colors resize-none"
                />
                <p className="mt-1 text-[10px] text-white/20 text-right">{message.length}/5000</p>
            </div>

            {status === "error" && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {errorMsg}
                </div>
            )}

            <button
                type="submit"
                disabled={status === "sending" || !name.trim() || !email.trim() || !message.trim()}
                className="w-full py-3 rounded-xl bg-accent-gold text-black font-bold text-sm uppercase tracking-wider hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                {status === "sending" ? "Sending..." : "Send Message"}
            </button>
        </form>
    );
}

// Wrapper: keys the form on session status so it remounts with correct defaults
export default function ContactForm() {
    const { data: session, status } = useSession();
    if (status === "loading") return null;
    return (
        <ContactFormInner
            key={session?.user?.email || "anon"}
            defaultName={session?.user?.name || ""}
            defaultEmail={session?.user?.email || ""}
        />
    );
}
