/* eslint-disable no-undef */
// staff-notifications-sw.js
// File ini dipertahankan untuk backward compatibility.
// Service Worker utama yang menangani push notification adalah:
// - /sw.js (Workbox SW, scope "/") — untuk PWA caching + push handler
// - /firebase-messaging-sw.js (Firebase Messaging SW) — background message handler
//
// File ini TIDAK terdaftar secara aktif. Jika browser memilikinya dari
// registrasi sebelumnya, event notificationclick di sini akan memastikan
// klik notifikasi tetap berfungsi.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const explicitUrl = data.url;
  const orderId = data.order_id;
  const ticketNumber = data.ticket_number;

  // Routing yang sama dengan firebase-messaging-sw.js dan sw.ts
  const targetPath =
    explicitUrl ||
    (orderId && ticketNumber
      ? `/dashboard/orders/${ticketNumber}`
      : ticketNumber
      ? `/track/${encodeURIComponent(ticketNumber)}`
      : "/dashboard/orders");

  const absoluteUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === absoluteUrl && "focus" in client) return client.focus();
        }
        for (const client of clientList) {
          try {
            if (
              new URL(client.url).origin === self.location.origin &&
              "navigate" in client
            ) {
              return client.navigate(absoluteUrl).then((c) => c && c.focus());
            }
          } catch {
            // ignore
          }
        }
        if (clients.openWindow) return clients.openWindow(absoluteUrl);
      })
  );
});