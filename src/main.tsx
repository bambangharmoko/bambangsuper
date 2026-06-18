import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// ── Registrasi Service Workers ────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // 1. Service Worker utama PWA (Workbox precache + runtime caching)
      //    Hanya tersedia di production build; di dev mode dimatikan
      if (import.meta.env.PROD) {
        const { registerSW } = await import("virtual:pwa-register");
        registerSW({
          immediate: true,
          onNeedRefresh() {
            // SW baru tersedia — bisa tampilkan notif "update tersedia" jika mau
            console.info("[PWA] Update tersedia. Refresh untuk versi terbaru.");
          },
          onOfflineReady() {
            console.info("[PWA] Aplikasi siap digunakan secara offline.");
          },
        });
      }

      // 2. Firebase Messaging Service Worker (push notification)
      //    Selalu diregister di prod maupun dev
      await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
        scope: "/",
      });
    } catch (err) {
      console.warn("[SW] Registrasi service worker gagal:", err);
    }
  });
}
