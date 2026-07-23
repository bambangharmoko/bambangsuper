/* eslint-disable no-undef */
// Service worker untuk Firebase Cloud Messaging (background push handler).
// Firebase web config bersifat publik; disimpan di sini agar background handler
// selalu aktif sinkron saat browser membangunkan service worker untuk push event.
//
// CATATAN PENTING (Service Worker Scope):
// File ini hanya digunakan sebagai SW khusus FCM yang terdaftar dengan scope "/".
// Jika Workbox SW (/sw.js) sudah aktif pada scope "/", Firebase SDK akan
// menggunakan Workbox SW tersebut untuk push token (via serviceWorkerRegistration).
// File ini tetap dipertahankan sebagai fallback dan untuk kompatibilitas.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDZ1Exuef_trrlf8uNuQRzZkeAmsQ-tcmY",
  authDomain: "super-komputer-app.firebaseapp.com",
  projectId: "super-komputer-app",
  messagingSenderId: "496927166341",
  appId: "1:496927166341:web:2a41c39ad1fb8f6052feec",
};

const readConfigFromUrl = () => {
  try {
    const urlParams = new URL(self.location.href).searchParams;
    return {
      apiKey: urlParams.get("apiKey"),
      authDomain: urlParams.get("authDomain"),
      projectId: urlParams.get("projectId"),
      messagingSenderId: urlParams.get("messagingSenderId"),
      appId: urlParams.get("appId"),
    };
  } catch {
    return {};
  }
};

const hasConfig = (config) =>
  !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId);

// Tampilkan notifikasi dari payload FCM
const showMessageNotification = (payload) => {
  try {
    const notification = payload.notification || {};
    const data = payload.data || {};

    const title = notification.title || data.title || "Update Servis";
    const body = notification.body || data.body || "";

    // Tentukan URL target berdasarkan konteks notifikasi:
    // - Notifikasi staff (ada order_id): buka /dashboard/orders/
    // - Notifikasi pelanggan (hanya ticket_number): buka /track/
    // - URL eksplisit dari data.url: gunakan langsung
    const targetPath =
      data.url ||
      (data.order_id && data.ticket_number
        ? `/dashboard/orders/${data.ticket_number}`
        : data.ticket_number
        ? `/track/${encodeURIComponent(data.ticket_number)}`
        : "/");

    const tag = data.order_id
      ? `staff-ticket-${data.order_id}`
      : data.ticket_number || "service-update";

    self.registration
      .showNotification(title, {
        body,
        icon: notification.icon || "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
        tag,
        data: { ...data, url: targetPath },
        requireInteraction: true,
      })
      .catch((err) => console.error("[FCM-SW] showNotification error:", err));
  } catch (err) {
    console.error("[FCM-SW] showMessageNotification error:", err);
  }
};

// Inisialisasi Firebase dengan config terbaik yang tersedia
let messagingReady = Promise.resolve(true);
try {
  const urlConfig = readConfigFromUrl();
  const firebaseConfig = hasConfig(urlConfig) ? urlConfig : defaultFirebaseConfig;

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(showMessageNotification);
  console.info("[FCM-SW] Firebase Messaging initialized, background handler active.");
} catch (err) {
  console.error("[FCM-SW] Firebase init error:", err);
}

// ── Install & Activate ─────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.info("[FCM-SW] Installing...");
  event.waitUntil(
    messagingReady.then(() => self.skipWaiting()).catch((err) => {
      console.error("[FCM-SW] Install error:", err);
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  console.info("[FCM-SW] Activating, claiming clients...");
  event.waitUntil(self.clients.claim());
});

// ── Notification Click Handler ─────────────────────────────────────────────
// Menangani klik notifikasi push — membuka atau memfokuskan tab yang relevan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const explicitUrl = data.url;
  const orderId = data.order_id;
  const ticketNumber = data.ticket_number;

  // Prioritas URL:
  // 1. URL eksplisit dari payload data.url (sudah di-set oleh edge function)
  // 2. Dashboard order jika ada order_id (notifikasi staff)
  // 3. Tracking page jika hanya ada ticket_number (notifikasi pelanggan)
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
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 1. Fokuskan tab yang sudah membuka URL target persis
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) {
            return client.focus();
          }
        }
        // 2. Navigasikan tab yang sama origin ke URL target
        for (const client of clientList) {
          try {
            if (
              new URL(client.url).origin === self.location.origin &&
              "navigate" in client
            ) {
              return client.navigate(absoluteUrl).then((c) => c && c.focus());
            }
          } catch {
            // ignore URL parse error
          }
        }
        // 3. Buka tab baru
        if (clients.openWindow) return clients.openWindow(absoluteUrl);
      })
      .catch((err) => console.error("[FCM-SW] notificationclick error:", err))
  );
});

// ── Fetch Handler ─────────────────────────────────────────────────────────
// Minimal fetch handler — wajib ada agar SW bisa mengontrol halaman.
// Semua request diteruskan ke jaringan seperti biasa.
// Strategi caching dihandle oleh Workbox SW (/sw.js) yang merupakan SW utama.
self.addEventListener("fetch", () => {
  // Tidak melakukan apa-apa — pass-through ke browser
});
