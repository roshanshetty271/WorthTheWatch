import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Worth the Watch? — Should I stream this? The internet decides.",
  description:
    "AI-powered movie and TV reviews synthesized from real internet opinions. Get honest verdicts on whether to stream it or skip it.",
  openGraph: {
    title: "Worth the Watch?",
    description: "Should I stream this? The internet decides.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 border-b border-surface-elevated/50 bg-surface/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <a href="/" className="flex items-center gap-2">
              <span className="font-display text-xl text-accent-gold sm:text-2xl">
                Worth the Watch?
              </span>
            </a>
            <a
              href="/search"
              className="rounded-full bg-surface-elevated px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              Search
            </a>
          </div>
        </nav>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-surface-elevated/50 py-8 text-center">
          <p className="text-sm text-text-muted">
            Worth the Watch? — Should I stream this? The internet decides.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            This product uses the TMDB API but is not endorsed or certified by
            TMDB.
          </p>
        </footer>
      </body>
    </html>
  );
}
