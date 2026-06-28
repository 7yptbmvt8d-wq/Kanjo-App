/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Costa Verde — papier crème, encre, pin et or.
        paper: {
          DEFAULT: "#F1E9DA",
          card: "#FBF7EE",
          dark: "#bcb4a4",
        },
        ink: {
          DEFAULT: "#221E18",
          soft: "#6B6253",
          muted: "#9A9078",
          body: "#3A352C",
          body2: "#4A4338",
        },
        pine: {
          DEFAULT: "#1F3A2E",
          dark: "#16291F",
          mid: "#244536",
          tab: "#1d3528",
        },
        gold: {
          DEFAULT: "#A98146",
          400: "#C9A86A",
          300: "#E2C488",
        },
        // Legacy palette kept around as fallbacks while the redesign lands —
        // remove once nothing references them.
        ink_soft: "#292524",
        vermillion: {
          50: "#fff1ed",
          200: "#fecaca",
          300: "#fca5a5",
          500: "#dc2626",
        },
        shu: { 500: "#d62828" },
        sand: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
        },
        washi: {
          DEFAULT: "#faf6ee",
          50: "#fdfbf6",
          100: "#faf6ee",
          200: "#f1ebde",
        },
      },
      fontFamily: {
        sans: [
          "Manrope",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: [
          "Spectral",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        kanji: ["Spectral", "'Shippori Mincho'", "serif"],
      },
      letterSpacing: {
        seal: "0.2em",
        section: "0.16em",
        mark: "0.18em",
      },
      boxShadow: {
        card: "0 8px 18px -14px rgba(34, 30, 24, 0.30)",
        device: "0 30px 60px -30px rgba(28, 25, 23, 0.35), 0 8px 24px -8px rgba(28, 25, 23, 0.15)",
        heroDark: "0 20px 34px -20px rgba(22, 41, 31, 0.85)",
        pinned: "0 10px 24px -16px rgba(169, 129, 70, 0.6)",
        lift: "0 12px 32px -16px rgba(28, 25, 23, 0.25), 0 4px 8px -4px rgba(28, 25, 23, 0.08)",
      },
      backgroundImage: {
        "hero-pine": "linear-gradient(150deg, #244536, #16291F)",
        "gold-bar": "linear-gradient(90deg, #C9A86A, #E2C488)",
        "tabbar-pine": "linear-gradient(#1d3528, #16291F)",
        "paper-radial":
          "radial-gradient(circle at 50% 22%, #dad3c4, #bcb4a4)",
      },
      animation: {
        "fade-in": "fadeIn 240ms ease-out both",
        "slide-up": "slideUp 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "slide-in-right": "slideInRight 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "pop": "pop 440ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "pulse-slow": "pulseSlow 2.8s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(1.15)" },
        },
        pop: {
          "0%": { opacity: "0", transform: "scale(0.86)" },
          "70%": { opacity: "1", transform: "scale(1.03)" },
          "100%": { transform: "scale(1)" },
        },
        pulseSlow: {
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 8px 24px rgba(169,129,70,0.40)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 12px 36px rgba(169,129,70,0.55)" },
        },
      },
    },
  },
  plugins: [],
};
