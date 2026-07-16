import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Registrasi Service Workers ────────────────────────────────────────────
// Strategi SW:
//   1. Workbox SW (/sw.js) — scope "/" — menangani caching PWA + push/notificationclick fallback
//   2. Firebase Messaging SW (/firebase-messaging-sw.js) — TIDAK didaftarkan ulang secara manual
//      karena firebase.ts akan menggunakan Workbox SW (scope "/") sebagai serviceWorkerRegistration
//      saat memanggil getToken(). Ini memastikan hanya 1 SW aktif pada scope "/".
//
// Mengapa tidak mendaftarkan firebase-messaging-sw.js terpisah?
// - Browser hanya mengizinkan 1 SW aktif per scope.
// - Mendaftarkan 2 SW pada scope "/" menyebabkan kompetisi: yang terakhir terdaftar menang,
//   tetapi yang lama bisa menyebabkan konflik atau push event terlewat.
// - Solusi terbaik: Workbox SW menangani semua (caching + push + notificationclick).
//   Firebase SDK (getToken) dikonfigurasi untuk menggunakan Workbox SW registration.

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      if (import.meta.env.PROD) {
        // Daftarkan Workbox SW sebagai SW utama (scope "/")
        const { registerSW } = await import("virtual:pwa-register");
        registerSW({
          immediate: true,
          onRegisteredSW(swUrl, registration) {
            // Cek update setiap 60 menit
            if (registration) {
              setInterval(() => {
                registration.update().catch((err) =>
                  console.warn("[PWA] SW update check failed:", err)
                );
              }, 60 * 60 * 1000);
            }
            console.info("[PWA] Service Worker terdaftar:", swUrl);
          },
          onOfflineReady() {
            console.info("[PWA] Aplikasi siap digunakan secara offline.");
          },
          onNeedRefresh() {
            console.info("[PWA] Versi baru tersedia. Memperbarui...");
          },
          onRegisterError(error) {
            console.error("[PWA] Service Worker gagal terdaftar:", error);
          },
        });
      }
      // Di dev mode, SW tidak didaftarkan untuk menghindari cache stale.
      // Push notification tidak berfungsi di dev mode — ini adalah perilaku yang diharapkan.
    } catch (err) {
      console.warn("[SW] Registrasi service worker gagal:", err);
    }
  });
}
