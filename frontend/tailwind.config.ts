import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Worth the Watch? brand colors — "Organic Editorial" (Matte/Zinc)
        surface: {
          DEFAULT: "#09090b", // Zinc 950 (Ink Black)
          card: "#18181b",    // Zinc 900
          elevated: "#27272a", // Zinc 800
          hover: "#27272a",   // Zinc 800 (Hover state)
        },
        accent: {
          gold: "#fbbf24",     // Amber 400 (Popcorn/Cinema Gold)
          goldLight: "#fcd34d", // Amber 300
        },
        verdict: {
          worth: "#22c55e",    // Green 500
          skip: "#ef4444",     // Red 500
          mixed: "#f59e0b",    // Amber 500
        },
        text: {
          primary: "#fafafa",  // Zinc 50 (High contrast)
          secondary: "#d4d4d8", // Zinc 300
          muted: "#a1a1aa",    // Zinc 400
        },
      },
      fontFamily: {
        display: ["var(--font-dm-serif)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        "serif-body": ["var(--font-lora)", "serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s infinite",
        "badge-pop": "badgePop 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        badgePop: {
          "0%": { opacity: "0", transform: "scale(0.8)" },
          "60%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px 0 rgba(251,191,36,0.15)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(251,191,36,0.3)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
