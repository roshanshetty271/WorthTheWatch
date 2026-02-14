import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  // 1. Base URL for resolving images
  metadataBase: new URL("https://worth-the-watch.vercel.app"),

  title: "Worth the Watch? — Should I stream this? The internet decides.",
  description:
    "AI-powered movie and TV reviews synthesized from real internet opinions. Get honest verdicts on whether to stream it or skip it.",

  // 2. OpenGraph (Facebook, WhatsApp, LinkedIn, Discord)
  openGraph: {
    title: "Worth the Watch?",
    description: "Should I stream this? The internet decides.",
    url: "https://worth-the-watch.vercel.app",
    siteName: "Worth the Watch?",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/images/og-image.png", // Points to public/images/og-image.png
        width: 1200,
        height: 630,
        alt: "Worth the Watch? - AI Movie Reviews",
      },
    ],
  },

  // 3. Twitter Card (Twitter/X)
  twitter: {
    card: "summary_large_image",
    title: "Worth the Watch?",
    description: "AI-powered verdicts on movies and TV shows.",
    images: ["/images/og-image.png"],
  },
  other: {
    "theme-color": "#09090b",
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
        <AuthProvider>
          {/* Scroll-aware Navigation */}
          <Navbar />

          {/* Main Content */}
          <main>{children}</main>
          <Analytics />

          {/* Footer */}
          <footer className="border-t border-surface-elevated/50 py-8 text-center">
            <p className="text-sm text-text-secondary">
              Worth the Watch? — Should I stream this? The internet decides.
            </p>
            <p className="mt-3 text-sm text-text-secondary">
              Created with ❤️ by{" "}
              <a
                href="https://www.roshanshetty.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-primary hover:underline"
              >
                Roshan Shetty
              </a>
            </p>
            <div className="mt-3 flex justify-center gap-4">
              <a
                href="https://www.roshanshetty.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-accent-primary transition-colors"
                aria-label="Portfolio"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/in/roshanshetty271/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-secondary hover:text-accent-primary transition-colors"
                aria-label="LinkedIn"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}