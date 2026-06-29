import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Registrasi Service Workers ────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // 1. Service Worker utama PWA (Workbox precache + runtime caching)
      //    autoUpdate: SW baru langsung aktif tanpa prompt → install / update terasa instan
      if (import.meta.env.PROD) {
        const { registerSW } = await import("virtual:pwa-register");
        registerSW({
          immediate: true,
          onRegisteredSW(swUrl, registration) {
            // Cek update setiap 60 menit
            if (registration) {
              setInterval(() => {
                registration.update();
              }, 60 * 60 * 1000);
            }
            console.info("[PWA] Service Worker terdaftar:", swUrl);
          },
          onOfflineReady() {
            console.info("[PWA] Aplikasi siap digunakan secara offline.");
          },
        });
      }

      // 2. Firebase Messaging Service Worker (push notification)
      //    Selalu diregister di prod maupun dev
      await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/firebase-cloud-messaging",
      });
    } catch (err) {
      console.warn("[SW] Registrasi service worker gagal:", err);
    }
  });
}
