/** @type {import('next').NextConfig} */
const nextConfig = {
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
