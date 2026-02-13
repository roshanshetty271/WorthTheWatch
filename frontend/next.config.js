/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https://image.tmdb.org https://*.tmdb.org blob:",
              "media-src 'self'",
              "connect-src 'self' https://depressed-effie-roshanshetty271-50ca8d16.koyeb.app https://api.anthropic.com",
              "frame-src 'self' https://www.youtube.com https://youtube.com",
            ].join('; ')
          }
        ]
      }
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "http",
        hostname: "www.impawards.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com", // Common for IMDB/Amazon images
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com", // Google cached images
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
