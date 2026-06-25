/* eslint-disable no-undef */
// Service worker untuk Firebase Cloud Messaging.
// Firebase web config bersifat publik; disimpan di sini agar background handler
// selalu aktif sinkron saat browser membangunkan service worker untuk push event.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

const configCache = "fcm-config-v1";
const configRequest = "/__firebase-messaging-config__";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDZ1Exuef_trrlf8uNuQRzZkeAmsQ-tcmY",
  authDomain: "super-komputer-app.firebaseapp.com",
  projectId: "super-komputer-app",
  messagingSenderId: "496927166341",
  appId: "1:496927166341:web:2a41c39ad1fb8f6052feec",
};

const readConfigFromUrl = () => {
  const urlParams = new URL(self.location.href).searchParams;
  return {
    apiKey: urlParams.get("apiKey"),
    authDomain: urlParams.get("authDomain"),
    projectId: urlParams.get("projectId"),
    messagingSenderId: urlParams.get("messagingSenderId"),
    appId: urlParams.get("appId"),
  };
};

const hasConfig = (config) => !!(config.apiKey && config.projectId && config.messagingSenderId && config.appId);

const persistConfig = async (config) => {
  if (!hasConfig(config)) return;
  const cache = await caches.open(configCache);
  await cache.put(configRequest, new Response(JSON.stringify(config), { headers: { "Content-Type": "application/json" } }));
};

const readPersistedConfig = async () => {
  const cache = await caches.open(configCache);
  const response = await cache.match(configRequest);
  return response ? response.json() : null;
};

const showMessageNotification = (payload) => {
  const title = payload.notification?.title || payload.data?.title || "Update Servis";
  const data = {
    ...(payload.data || {}),
    url: payload.data?.url || (payload.data?.ticket_number ? `/track/${encodeURIComponent(payload.data.ticket_number)}` : undefined),
  };

  self.registration.showNotification(title, {
    body: payload.notification?.body || payload.data?.body || "",
    icon: "/superkomputer.png",
    badge: "/superkomputer.png",
    tag: data.order_id ? `staff-ticket-${data.order_id}` : data.ticket_number || "service-update",
    data,
    requireInteraction: true,
  });
};

// Service worker ini dipakai bersama untuk FCM pelanggan dan notifikasi staff.
let messagingReady = Promise.resolve(true);

const firebaseConfig = hasConfig(readConfigFromUrl()) ? readConfigFromUrl() : defaultFirebaseConfig;
messagingReady = persistConfig(firebaseConfig).catch(() => undefined).then(() => true);
firebase.initializeApp(firebaseConfig);
firebase.messaging().onBackgroundMessage(showMessageNotification);

self.addEventListener("install", (event) => {
  event.waitUntil(messagingReady.then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Klik notifikasi → buka halaman tracking
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const explicitUrl = event.notification.data?.url;
  const ticket = event.notification.data?.ticket_number;
  const url = explicitUrl || (ticket ? `/track/${encodeURIComponent(ticket)}` : "/track");
  const absoluteUrl = new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === absoluteUrl && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(absoluteUrl);
    })
  );
});

// Fetch event listener untuk memenuhi kriteria instalasi PWA
self.addEventListener("fetch", (event) => {
  // Biarkan browser menangani request jaringan seperti biasa.
  // Anda dapat menambahkan strategi caching di sini jika diperlukan nanti.
});

