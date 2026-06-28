/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kanjo Aïkido Isulanu — noir profond & or.
        // Surfaces sombres : `paper` est le fond de page / des cartes (sombre),
        // `pine` les surfaces d'accent (héros, onglets), `night` les pastilles
        // sombres. `cream` porte le texte/overlay clair sur fond sombre.
        paper: {
          DEFAULT: "#090805",
          card: "#15120b",
          dark: "#1c1a13",
        },
        // Texte clair sur fond sombre + overlays translucides clairs.
        cream: {
          DEFAULT: "#f1e8d2",
          card: "#ece3cf",
        },
        // Pastilles / chips sombres (anciennement bg-ink).
        night: {
          DEFAULT: "#0d0b07",
        },
        // Texte principal et nuances (clair → gris-or atténué).
        ink: {
          DEFAULT: "#ece3cf",
          soft: "#bcb39f",
          muted: "#8a7d5c",
          body: "#bcb39f",
          body2: "#aaa18d",
        },
        // Surfaces d'accent sombres (héros, dégradés, tab bar).
        pine: {
          DEFAULT: "#15120b",
          dark: "#090805",
          mid: "#1c1a13",
          tab: "#0d0b07",
        },
        // Or Kanjo.
        gold: {
          DEFAULT: "#c9a24d",
          400: "#d4b56a",
          300: "#e2c488",
        },
        ink_soft: "#bcb39f",
        // Legacy palette kept around as fallbacks — unused by the Kanjo skin.
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
          DEFAULT: "#1c1a13",
          50: "#15120b",
          100: "#15120b",
          200: "#1c1a13",
        },
      },
      fontFamily: {
        // Space Grotesk — eyebrows, labels, boutons, onglets, corps UI.
        sans: [
          "'Space Grotesk'",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        // Cinzel — titres, chiffres, kanji latinisés.
        display: ["Cinzel", "ui-serif", "Georgia", "serif"],
        // Cormorant Garamond — corps éditorial, citations.
        serif: ["'Cormorant Garamond'", "ui-serif", "Georgia", "serif"],
        // Kanji affichés tels quels — Cinzel + repli CJK système.
        kanji: ["Cinzel", "'Shippori Mincho'", "serif"],
      },
      letterSpacing: {
        seal: "0.2em",
        section: "0.16em",
        mark: "0.18em",
      },
      boxShadow: {
        card: "0 8px 18px -14px rgba(0, 0, 0, 0.55)",
        device: "0 30px 60px -30px rgba(0, 0, 0, 0.65), 0 8px 24px -8px rgba(0, 0, 0, 0.45)",
        heroDark: "0 20px 34px -20px rgba(0, 0, 0, 0.85)",
        pinned: "0 10px 24px -16px rgba(201, 162, 77, 0.6)",
        lift: "0 12px 32px -16px rgba(0, 0, 0, 0.55), 0 4px 8px -4px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        "hero-pine": "radial-gradient(circle at 50% 0%, #1c1a13, #090805 70%)",
        "gold-bar": "linear-gradient(90deg, #d4b56a, #e2c488)",
        "tabbar-pine": "linear-gradient(rgba(9,8,5,0.72), #090805)",
        "paper-radial":
          "radial-gradient(circle at 50% 22%, #15120b, #090805)",
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
          "0%, 100%": { transform: "scale(1)", boxShadow: "0 8px 24px rgba(201,162,77,0.40)" },
          "50%": { transform: "scale(1.05)", boxShadow: "0 12px 36px rgba(201,162,77,0.55)" },
        },
      },
    },
  },
  plugins: [],
};
