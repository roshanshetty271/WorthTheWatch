import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AuthProvider from "@/components/AuthProvider";
import CantDecideFooterLink from "@/components/CantDecideFooterLink";
import { DM_Sans, DM_Serif_Display, Lora } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://worth-the-watch.com'),
  title: {
    default: 'Worth the Watch? — Don\'t watch another bad movie.',
    template: '%s | Worth the Watch?',
  },
  description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
  keywords: [
    'movie reviews', 'is it worth watching', 'movie verdict',
    'AI movie reviews', 'Reddit movie opinions', 'should I watch',
    'movie recommendations', 'what to watch tonight',
  ],
  openGraph: {
    title: 'Worth the Watch? — Don\'t watch another bad movie.',
    description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
    siteName: 'Worth the Watch?',
    images: [{ url: '/twitter-share.jpg', width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Worth the Watch? — Don\'t watch another bad movie.',
    description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
    images: ['/twitter-share.jpg'],
    creator: '@MFamily72657',
  },
  verification: {
    google: 'jQOk60O_Ce2dQkhWwkVnKLkl-aPksftS0VkCG6SnJjw',
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = process.env.MAINTENANCE_MODE === "true";

  // In maintenance mode the whole site rewrites to /maintenance at runtime.
  // We drop the Navbar + footer so the maintenance page renders clean, but we
  // KEEP AuthProvider: Next still prerenders every page at build time, and
  // several (e.g. /contact, /profile) call useSession() — removing the
  // SessionProvider makes those prerenders crash the build. SessionProvider is
  // JWT-based and never touches the (down) database.
  if (maintenance) {
    return (
      <html lang="en">
        <body className={`${dmSans.variable} ${dmSerif.variable} ${lora.variable} min-h-screen bg-surface`}>
          <AuthProvider>{children}</AuthProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body className={`${dmSans.variable} ${dmSerif.variable} ${lora.variable} min-h-screen bg-surface`}>
        <AuthProvider>
          {/* Scroll-aware Navigation */}
          <Navbar />

          {/* Main Content */}
          <main>{children}</main>
          <Analytics />
          <SpeedInsights />

          {/* Footer */}
          <footer className="border-t border-surface-elevated/50 mt-12">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12">
              <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-display text-lg text-white">Worth the Watch?</p>
                  <p className="mt-1 text-sm text-text-secondary/60">Don&apos;t watch another bad movie.</p>
                </div>

                <nav className="flex gap-x-10 gap-y-2 flex-wrap text-sm" aria-label="Footer">
                  <Link href="/discover" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">Discover</Link>
                  <Link href="/browse/mood/tired" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">Mood Based</Link>
                  <Link href="/versus" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">Movie Battle</Link>
                  <Link href="/my-list" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">My List</Link>
                  <CantDecideFooterLink />
                  <Link href="/contact" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">Contact</Link>
                  <Link href="/privacy" className="text-text-secondary hover:text-accent-gold active:text-accent-gold transition-colors duration-200">Privacy Policy</Link>
                </nav>
              </div>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
