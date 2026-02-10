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
          secondary: "#a1a1aa", // Zinc 400
          muted: "#71717a",    // Zinc 500
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "Georgia", "serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s infinite",
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
      },
    },
  },
  plugins: [],
};

export default config;
