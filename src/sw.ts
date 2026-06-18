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

// ── Install & Activate ─────────────────────────────────────────────────────
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
