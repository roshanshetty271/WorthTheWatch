import type { MetadataRoute } from 'next';

/**
 * Private routes stay disallowed for everyone; search engines keep full access
 * to the public catalogue.
 *
 * The AI_CRAWLERS block is a request, not a control — robots.txt is advisory
 * and the crawlers that actually cost money are the ones most likely to ignore
 * it. The enforcing layer is Vercel's firewall (Bot Management → AI Bots, set
 * to Deny). This list is here so the well-behaved ones stop on their own, and
 * so there is a written record of intent if one of them ever has to be argued
 * with.
 *
 * Googlebot, Bingbot and DuckDuckBot are deliberately absent: those bring real
 * visitors. Google-Extended and Applebot-Extended are the AI-training arms of
 * Google and Apple and opting out of them does NOT affect search ranking.
 */
const AI_CRAWLERS = [
    'GPTBot',
    'OAI-SearchBot',
    'ChatGPT-User',
    'ClaudeBot',
    'Claude-Web',
    'anthropic-ai',
    'CCBot',
    'PerplexityBot',
    'Perplexity-User',
    'Bytespider',
    'Amazonbot',
    'Applebot-Extended',
    'Google-Extended',
    'meta-externalagent',
    'FacebookBot',
    'cohere-ai',
    'Diffbot',
    'ImagesiftBot',
    'Omgilibot',
    'Timpibot',
    'YouBot',
    'Scrapy',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: ['/api/', '/auth/', '/my-list', '/profile', '/history'],
            },
            {
                userAgent: AI_CRAWLERS,
                disallow: '/',
            },
        ],
        sitemap: 'https://worth-the-watch.com/sitemap.xml',
    };
}
