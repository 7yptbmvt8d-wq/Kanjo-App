import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // "prompt" : la nouvelle version est téléchargée en fond mais activée
      // seulement quand l'adhérent tape le bandeau (src/UpdateBanner.jsx),
      // au lieu d'un rechargement silencieux qui pouvait laisser voir une
      // vieille version tant que l'app n'était pas fermée/rouverte.
      registerType: "prompt",
      includeAssets: ["favicon-48.png", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Kanjo Aïkido Isulanu",
        short_name: "Kanjo Aïkido",
        description:
          "L'app des adhérents du Kanjo Aïkido Isulanu (Vescovato, Corse). Planning, annonces, appel, fiches de progression.",
        theme_color: "#090805",
        background_color: "#090805",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "fr",
        categories: ["sports", "lifestyle"],
        icons: [
          // Icônes générées depuis public/branding/logo-kanjo.png (2048²).
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff2}"],
        // Le logo source 2048² (1,7 Mo) n'est jamais affiché dans l'app
        // (seules les icônes PWA dérivées le sont) — inutile de l'alourdir
        // le précache / l'installation du service worker.
        globIgnores: ["**/branding/logo-kanjo.png"],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/messaging",
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
