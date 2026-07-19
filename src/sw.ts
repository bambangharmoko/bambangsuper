/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import {
  CacheFirst,
  NetworkFirst,
  StaleWhileRevalidate,
} from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope;

// ── Precache semua aset yang di-build Vite ──────────────────────────────────
// Workbox akan mengisi array ini saat build
precacheAndRoute(self.__WB_MANIFEST);

// Hapus cache dari versi lama
cleanupOutdatedCaches();

// ── Navigation fallback (SPA routing) ──────────────────────────────────────
// Semua navigasi ke URL yang tidak di-cache → sajikan index.html dari cache
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    // Jangan intercept service worker itu sendiri atau asset Firebase
    denylist: [/\/firebase-messaging-sw\.js/, /\/staff-notifications-sw\.js/],
  })
);

// ── Runtime Caching ────────────────────────────────────────────────────────

// 1. Google Fonts stylesheet
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// 2. Google Fonts file (woff2, dll.)
registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365, maxEntries: 30 }),
    ],
  })
);

// 3. Supabase Storage (gambar/foto unit) — CacheFirst, expire 7 hari
registerRoute(
  ({ url }) =>
    url.hostname.includes("supabase.co") &&
    (url.pathname.includes("/storage/") || url.pathname.includes("/object/")),
  new CacheFirst({
    cacheName: "supabase-storage",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 7, maxEntries: 200 }),
    ],
  })
);

// 4. Supabase REST API — NetworkFirst (data real-time), fallback ke cache
registerRoute(
  ({ url }) =>
    url.hostname.includes("supabase.co") && url.pathname.includes("/rest/"),
  new NetworkFirst({
    cacheName: "supabase-api",
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 5, maxEntries: 100 }),
    ],
  })
);

// 5. Firebase / GStatic assets (compat scripts)
registerRoute(
  ({ url }) =>
    url.hostname === "www.gstatic.com" ||
    url.hostname === "firebaseinstallations.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "firebase-assets",
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
  })
);

// 6. Dynamic Assets (JS/CSS dari Code Splitting yang tidak di-precache)
registerRoute(
  ({ request, url }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css"),
  new StaleWhileRevalidate({
    cacheName: "dynamic-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 30, maxEntries: 100 }), // 30 hari
    ],
  })
);

// ── Install & Activate ─────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Push Notification Handler ──────────────────────────────────────────────
// SW utama (Workbox) juga meng-handle push event sebagai fallback
// untuk kasus di mana firebase-messaging-sw.js tidak terdaftar sebagai SW aktif.
// Firebase SDK akan otomatis memilih SW yang terdaftar dengan scope "/" saat
// getToken() dipanggil tanpa serviceWorkerRegistration eksplisit.
self.addEventListener("push", (event: PushEvent) => {
  // Firebase SDK biasanya menangani push event melalui onBackgroundMessage.
  // Handler ini adalah fallback untuk payload yang tidak ditangani Firebase.
  if (!event.data) return;

  let payload: Record<string, any> = {};
  try {
    payload = event.data.json();
  } catch {
    // Payload bukan JSON — abaikan
    return;
  }

  // Jika Firebase sudah menangani (payload memiliki format FCM dengan 'notification'),
  // kita cukup tampilkan notifikasi dari data field sebagai backup.
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "SUMTRA";
  const body = notification.body || data.body || "";
  const icon = notification.icon || "/icon-192.png";
  const badge = notification.badge || "/icon-192.png";
  const tag = data.order_id
    ? `staff-ticket-${data.order_id}`
    : data.ticket_number || "service-update";

  // Tentukan URL target berdasarkan konteks notifikasi
  const targetUrl =
    data.url ||
    (data.order_id
      ? `/dashboard/orders/${data.ticket_number || data.order_id}`
      : data.ticket_number
        ? `/track/${encodeURIComponent(data.ticket_number)}`
        : "/");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { ...data, url: targetUrl },
      requireInteraction: true,
    })
  );
});

// ── Notification Click Handler ─────────────────────────────────────────────
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  // Ambil URL dari data notifikasi (sudah di-set oleh edge function atau push handler)
  const explicitUrl = event.notification.data?.url;
  const orderId = event.notification.data?.order_id;
  const ticketNumber = event.notification.data?.ticket_number;

  // Prioritas URL:
  // 1. URL eksplisit dari payload data.url
  // 2. Dashboard order jika ada order_id (notifikasi staff)
  // 3. Tracking page jika ada ticket_number (notifikasi pelanggan)
  // 4. Halaman utama sebagai fallback
  const targetPath =
    explicitUrl ||
    (orderId && ticketNumber
      ? `/dashboard/orders/${ticketNumber}`
      : ticketNumber
        ? `/track/${encodeURIComponent(ticketNumber)}`
        : "/");

  const absoluteUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Cari tab yang sudah membuka URL target
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) {
            return (client as WindowClient).focus();
          }
        }
        // Cari tab yang membuka origin yang sama dan navigasikan
        for (const client of clientList) {
          if (
            new URL(client.url).origin === self.location.origin &&
            "navigate" in client
          ) {
            return (client as WindowClient).navigate(absoluteUrl).then((c) => c?.focus());
          }
        }
        // Buka tab baru
        return self.clients.openWindow(absoluteUrl);
      })
  );
});
