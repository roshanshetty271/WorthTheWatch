import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/auth/', '/my-list'],
            },
        ],
        sitemap: 'https://worth-the-watch.vercel.app/sitemap.xml',
    };
}
