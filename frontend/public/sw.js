// Minimaler Service Worker nur für Web-Push-Benachrichtigungen (kein Offline-Caching/PWA-Anspruch
// hier – das übernimmt der reine Read-Cache/Outbox-Mechanismus in api/client.ts auf App-Ebene).
// Muss unter /sw.js (Root-Scope) liegen, damit er Push-Events für die ganze App empfangen darf.

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const { title, body, tripId } = payload;
  event.waitUntil(
    self.registration.showNotification(title ?? 'Reisotor', {
      body,
      icon: '/reisotor_logo.svg',
      badge: '/reisotor_logo.svg',
      data: { url: tripId ? '/' : '/' },
    }),
  );
});

// Klick auf die Benachrichtigung fokussiert ein bereits offenes App-Tab statt ein neues zu öffnen,
// falls eins existiert (üblicheres Verhalten für "zurück zur App").
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
