import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Worth the Watch?",
        short_name: "WorthWatch",
        description: "AI-powered movie and TV reviews. Should you stream it or skip it?",
        start_url: "/",
        display: "standalone",
        background_color: "#09090b",
        theme_color: "#09090b",
        icons: [
            {
                src: "/images/icon-192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/images/icon-512.png",
                sizes: "512x512",
                type: "image/png",
            },
        ],
    }
}
