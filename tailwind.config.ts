import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ember: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        flame: {
          400: "#ff6b35",
          500: "#f43f1e",
          600: "#d92d0b",
          700: "#b31f06",
        },
        gold: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        coal: {
          900: "#0b0a09",
          850: "#121010",
          800: "#171413",
          700: "#211c1a",
          600: "#2e2724",
          500: "#3d3430",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "fire-gradient": "linear-gradient(135deg, #d92d0b 0%, #f97316 45%, #fbbf24 100%)",
        "fire-soft": "linear-gradient(135deg, rgba(217,45,11,0.18) 0%, rgba(249,115,22,0.12) 50%, rgba(251,191,36,0.10) 100%)",
      },
      boxShadow: {
        ember: "0 10px 40px -12px rgba(249,115,22,0.45)",
        "ember-sm": "0 4px 18px -6px rgba(249,115,22,0.4)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
