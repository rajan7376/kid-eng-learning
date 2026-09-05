import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        rounded: ["var(--font-rounded)", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#6c5ce7",
          soft: "#a29bfe",
        },
      },
    },
  },
  plugins: [],
};

export default config;
