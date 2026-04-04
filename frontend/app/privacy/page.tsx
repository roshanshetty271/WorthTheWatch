import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "How Worth the Watch? handles your data.",
    alternates: { canonical: "https://worth-the-watch.com/privacy" },
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen pt-28 md:pt-32 pb-16 px-4">
            <div className="mx-auto max-w-2xl">
                <h1 className="font-display text-3xl md:text-4xl text-white mb-8">
                    Privacy Policy
                </h1>
                <p className="text-xs text-white/30 mb-8">Last updated: April 1, 2026</p>

                <div className="space-y-8 text-sm text-white/70 leading-relaxed">
                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">What we collect</h2>
                        <p>
                            When you sign in with Google, we receive your name, email address, and profile picture.
                            We use this to create your account and display your profile.
                        </p>
                        <p className="mt-2">
                            We also collect anonymous usage data: which movies you view, verdicts you generate,
                            battles you play, and roulette spins. For anonymous users, we store a random browser
                            token (cookie) for rate limiting purposes.
                        </p>
                        <p className="mt-2">
                            If you use our contact form, we store your name, email, message, and a hashed version
                            of your IP address (for abuse prevention). The raw IP is never stored.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">How we use it</h2>
                        <ul className="list-disc list-inside space-y-1.5">
                            <li>Account creation and authentication</li>
                            <li>Saving your watchlist and syncing across devices</li>
                            <li>Building your taste profile (genres, decades, activity stats)</li>
                            <li>Rate limiting to prevent abuse</li>
                            <li>Improving the service</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">How we store it</h2>
                        <p>
                            Your data is stored in a PostgreSQL database hosted by Neon (neon.tech)
                            in the US East region. Authentication is handled by NextAuth.js with JWT tokens.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">What we don&apos;t do</h2>
                        <ul className="list-disc list-inside space-y-1.5">
                            <li>We do not sell your data to anyone</li>
                            <li>We do not share your data with third parties for marketing</li>
                            <li>We do not use your data for advertising</li>
                            <li>We do not track you across other websites</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">Cookies</h2>
                        <p>
                            We use a session cookie for authentication and a <code className="text-white/50">wtw_anon_id</code> cookie
                            to identify anonymous browsers for rate limiting. No third-party tracking cookies are used.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">Third-party services</h2>
                        <p>We use the following services to operate the app:</p>
                        <ul className="list-disc list-inside space-y-1.5 mt-2">
                            <li>Google OAuth (authentication)</li>
                            <li>TMDB API (movie data)</li>
                            <li>Vercel (frontend hosting)</li>
                            <li>Koyeb (backend hosting)</li>
                            <li>Neon (database)</li>
                            <li>Resend (email delivery for contact form notifications)</li>
                        </ul>
                        <p className="mt-2">Each service has its own privacy policy governing their handling of data.</p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">Data deletion</h2>
                        <p>
                            To request deletion of your account and associated data, reach out through our{" "}
                            <a href="/contact" className="text-accent-gold hover:text-accent-gold/80 underline">
                                contact form
                            </a>.
                            Please include the email address associated with your account.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold text-white mb-3">Changes</h2>
                        <p>
                            We may update this policy from time to time. Changes will be reflected on this page
                            with an updated date.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
