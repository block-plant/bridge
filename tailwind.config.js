/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        rose:     { DEFAULT: "#e8a0a0", light: "#f5d0d0", deep: "#c96b6b" },
        blush:    { DEFAULT: "#f5d0d0", dark: "#e8a0a0" },
        cream:    { DEFAULT: "#fdf6f0", dark: "#f5ebe0" },
        plum:     { DEFAULT: "#8b3a5a", light: "#b05a78", dark: "#5c2040" },
        softdark: { DEFAULT: "#2d1b2e", light: "#4a2f4b" },
      },
      fontFamily: {
        serif: ["Cormorant Garamond", "Georgia", "serif"],
        sans:  ["DM Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        "petal": "radial-gradient(ellipse at 20% 50%, #f5d0d0 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #e8d5f5 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, #fdf6f0 0%, transparent 50%)",
      },
      boxShadow: {
        "rose": "0 4px 24px rgba(232, 160, 160, 0.3)",
        "plum": "0 4px 24px rgba(139, 58, 90, 0.2)",
        "soft": "0 2px 20px rgba(45, 27, 46, 0.08)",
        "glow": "0 0 40px rgba(232, 160, 160, 0.4)",
      },
    },
  },
  plugins: [],
};