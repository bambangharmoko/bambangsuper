/* eslint-disable no-undef */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard/orders";
  const absoluteUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === absoluteUrl && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(absoluteUrl);
    })
  );
});