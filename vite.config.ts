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
        // Jangan precache service worker Firebase, dan jangan precache async chunks
        globIgnores: [
          "firebase-messaging-sw.js", 
          "staff-notifications-sw.js",
          "assets/async/*.js"
        ],
        // Rollup input untuk SW (TypeScript)
        rollupFormat: "es",
      },

      // SW akan di-output ke dist/sw.js
      outDir: "dist",

      // Jangan konflik dengan SW Firebase yang sudah ada
      registerType: "autoUpdate",
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        chunkFileNames: (chunkInfo) => {
          // Masukkan halaman (dynamic entry) atau chunk async ke folder async (di-ignore oleh PWA precache)
          if (chunkInfo.isDynamicEntry || chunkInfo.name.includes("async")) {
            return "assets/async/[name]-[hash].js";
          }
          // Masukkan file vendor/core ke folder core agar ter-precache
          return "assets/core/[name]-[hash].js";
        },
        entryFileNames: "assets/core/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react") || id.includes("recharts") || id.includes("html5-qrcode")) {
              return "async-vendor-heavy";
            }
            if (id.includes("date-fns") || id.includes("react-day-picker")) {
              return "async-vendor-date";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            // Biarkan Vite menangani sisa node_modules secara otomatis
            // untuk menghindari Circular Dependency runtime yang menyebabkan Blank White Screen
          }
        },
      },
    },
  },
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
