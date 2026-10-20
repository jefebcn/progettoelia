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
        // Console operatore (tema chiaro)
        brand: {
          DEFAULT: "#15803d",
          dark: "#166534",
        },
        // Tema "villaggio di Natale" delle pagine visitatori
        pine: {
          DEFAULT: "#123329", // verde abete
          deep: "#0b2019",
          light: "#1b4537",
        },
        holly: {
          DEFAULT: "#b3262e", // rosso natale
          dark: "#8a1c23",
          light: "#d6454d",
        },
        gold: {
          DEFAULT: "#d4a548",
          light: "#ecc97a",
          dark: "#a97c2c",
        },
        cream: "#f6efe2",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      keyframes: {
        bokeh: {
          "0%, 100%": { transform: "translateY(0)", opacity: "var(--o, 0.6)" },
          "50%": { transform: "translateY(-10px)", opacity: "calc(var(--o, 0.6) * 0.55)" },
        },
        glow: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(110, 231, 183, 0.45)" },
          "50%": { boxShadow: "0 0 0 10px rgba(110, 231, 183, 0)" },
        },
      },
      animation: {
        bokeh: "bokeh 8s ease-in-out infinite",
        glow: "glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
