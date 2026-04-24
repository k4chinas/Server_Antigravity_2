/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // Özel koyu tema renk paleti
        surface: {
          900: "#0a0e1a",
          800: "#111827",
          700: "#1a2035",
          600: "#243049",
        },
        accent: {
          cyan: "#06d6a0",
          blue: "#118ab2",
          purple: "#7b2cbf",
          orange: "#ff6b35",
          red: "#ef233c",
          yellow: "#ffd60a",
        },
        neon: {
          green: "#39ff14",
          blue: "#00f0ff",
          pink: "#ff2cf1",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(6, 214, 160, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(6, 214, 160, 0.6)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
