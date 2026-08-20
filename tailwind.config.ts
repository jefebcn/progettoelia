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
        // Palette natalizia
        brand: {
          DEFAULT: "#15803d", // verde abete
          dark: "#166534",
        },
        holly: {
          DEFAULT: "#b91c1c", // rosso natale
          dark: "#991b1b",
        },
        gold: {
          DEFAULT: "#d4a017",
          dark: "#b8860b",
        },
      },
    },
  },
  plugins: [],
};

export default config;
