import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 900: "#0f1419", 950: "#0a0e12" },
        alert: { DEFAULT: "#f97316", dim: "#ea580c" },
        accent: "#38bdf8",
      },
    },
  },
  plugins: [],
};

export default config;
