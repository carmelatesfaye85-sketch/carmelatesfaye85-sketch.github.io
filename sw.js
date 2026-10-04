// OwnIt service worker: shows the "time's up" notification and brings you back to OwnIt when you tap it.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function show(data) {
  return self.registration.showNotification(data.title || "Time's up", {
    body: data.body || "Did you find what you came for? Tap to check in.",
    tag: data.tag || "ownit-checkin",
    renotify: true,
    requireInteraction: true,
    icon: "icon-192.png",
    badge: "icon-192.png",
    vibrate: [300, 120, 300, 120, 300],
    data: { url: self.registration.scope + "?checkin=1" },
  });
}

// Sent by the OwnIt server when a visit's time runs out (works even when OwnIt is closed).
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  event.waitUntil(show(data));
});

// Sent by the OwnIt page itself when its timer runs out while you're in another app.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "ownit-notify") event.waitUntil(show(event.data.payload || {}));
});

// Tapping the notification opens OwnIt (or switches back to it if it's already open).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) {
        client.postMessage({ type: "ownit-checkin" });
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
