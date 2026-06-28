import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png", "branding/logo-kanjo.svg"],
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
          // Stopgap SVG icon (faithful placeholder). Remplacer/compléter par
          // les PNG via `npm run generate-pwa-assets` une fois le logo fourni.
          { src: "branding/logo-kanjo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
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
