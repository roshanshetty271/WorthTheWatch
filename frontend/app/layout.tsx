import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { Analytics } from "@vercel/analytics/next";
import AuthProvider from "@/components/AuthProvider";
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
  metadataBase: new URL('https://worth-the-watch.vercel.app'),
  title: 'Worth the Watch? — Don\'t watch another bad movie.',
  description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
  openGraph: {
    title: 'Worth the Watch? — Don\'t watch another bad movie.',
    description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
    siteName: 'Worth the Watch?',
    images: [{ url: '/twitter-share.jpg', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Worth the Watch? — Don\'t watch another bad movie.',
    description: 'Search any title to get an instant, AI-powered verdict from fans and critics. No spoilers, just the truth.',
    images: ['/twitter-share.jpg'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

          {/* Footer */}
          <footer className="border-t border-surface-elevated/50 py-8 text-center">
            <p className="text-sm text-text-secondary">
              Worth the Watch? — Should I stream this? The internet decides.
            </p>

          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}