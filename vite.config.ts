import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode: _mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      // "injectManifest" = kita tulis SW sendiri (src/sw.ts),
      // Workbox hanya meng-inject daftar precache ke dalam SW tersebut.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // Jangan daftarkan SW di dev mode (mencegah cache stale saat development)
      devOptions: {
        enabled: false,
        type: "module",
      },

      // Manifest sudah ada di /public/manifest.json — cukup referensikan
      manifest: false,

      injectManifest: {
        // Glob patterns aset yang akan di-precache
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Jangan precache service worker Firebase itu sendiri
        globIgnores: ["firebase-messaging-sw.js", "staff-notifications-sw.js"],
        // Rollup input untuk SW (TypeScript)
        rollupFormat: "es",
      },

      // SW akan di-output ke dist/sw.js
      outDir: "dist",

      // Jangan konflik dengan SW Firebase yang sudah ada
      registerType: "autoUpdate",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "@radix-ui/react-tooltip",
    ],
  },
}));
