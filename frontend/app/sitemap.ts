import type { MetadataRoute } from 'next';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const SITE_URL = 'https://worth-the-watch.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
        { url: `${SITE_URL}/discover`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/versus`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
        { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${SITE_URL}/browse/worth-it`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/browse/skip-these`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
        { url: `${SITE_URL}/browse/mixed-bag`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
        { url: `${SITE_URL}/browse/hidden-gems`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
        { url: `${SITE_URL}/browse/tv-shows`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    ];

    // Dynamic movie pages — fetch all reviewed movies
    let moviePages: MetadataRoute.Sitemap = [];

    try {
        const res = await fetch(`${API_BASE}/api/sitemap`, {
            next: { revalidate: 3600 },
        });

        if (res.ok) {
            const movies: Array<{ tmdb_id: number; updated_at: string; title: string }> = await res.json();
            moviePages = movies.map((m) => ({
                url: `${SITE_URL}/movie/${m.tmdb_id}`,
                lastModified: new Date(m.updated_at),
                changeFrequency: 'weekly' as const,
                priority: 0.6,
            }));
        }
    } catch (e) {
        console.error('Failed to fetch sitemap data:', e);
    }

    return [...staticPages, ...moviePages];
}
