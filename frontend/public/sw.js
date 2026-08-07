// Service Worker für Web-Push-Benachrichtigungen UND (per vite-plugin-pwa's injectManifest-
// Strategie, siehe vite.config.ts) die Offline-App-Shell: __WB_MANIFEST wird beim Build automatisch
// durch die Liste aller zu precachenden Assets ersetzt. Muss unter /sw.js (Root-Scope) liegen,
// damit er sowohl Push-Events für die ganze App empfangen als auch die ganze App precachen darf.
// Das bestehende Daten-Offline-Konzept (localStorage-Lese-Cache/Mutations-Outbox, siehe
// api/client.ts/api/offline.ts) bleibt bewusst unberührt – hier wird NUR die App-Shell (HTML/JS/
// CSS/Fonts/Icons) gecacht, kein zweiter, konkurrierender Cache-Layer für /api/*-Antworten.
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

precacheAndRoute(self.__WB_MANIFEST);
// SPA-Fallback: jede Navigation (auch ein Deep-Link wie /todo ohne Netz) liefert die gecachte
// index.html aus, der Client-seitige Router (vue-router) übernimmt danach normal.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Kartenkacheln (TripMap.vue/ExcursionMiniMap.vue, Leaflet gegen den öffentlichen
// OSM-Tile-Server) sind weder Teil des obigen App-Shell-Precache (nur JS/CSS/HTML/Icons/Fonts)
// noch des localStorage-Datencaches (api/offline.ts, ungeeignet für Bilddaten) - ohne eigene
// Route bleiben bereits angesehene Kartenausschnitte offline nicht erhalten. CacheFirst statt
// StaleWhileRevalidate, weil sich einmal gerenderte Kacheln praktisch nie ändern; ExpirationPlugin
// begrenzt das Wachstum, CacheableResponsePlugin lässt auch response type "opaque" (Cross-Origin
// ohne CORS-Header) zu, ohne die (mit CORS-Headern versehene) Antwort des OSM-Tile-Servers
// fälschlich als Fehler zu behandeln.
// maxEntries großzügig bemessen (statt z. B. 500): utils/offlineMapTiles.ts lädt auf Wunsch gezielt
// den sichtbaren Kartenausschnitt über mehrere Zoomstufen vorab herunter (für den "totalen"
// Offline-Fall) - das kann leicht in die Tausende Kacheln gehen; ein zu knapper Deckel würde gerade
// erst heruntergeladene Kacheln durch die eigene Downloadschleife selbst wieder verdrängen.
registerRoute(
  ({ url }) => url.hostname.endsWith('.tile.openstreetmap.org') && /\/\d+\/\d+\/\d+\.png$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'osm-tiles',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 3000, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// PwaUpdatePrompt.vue's "Neu laden"-Button ruft vite-plugin-pwa's updateSW(true) auf, das genau
// diese Nachricht an den WARTENDEN (neuen) Service Worker schickt, um ihn sofort zu aktivieren statt
// auf das natürliche Ende aller offenen Tabs zu warten. Bei der generateSW-Strategie fügt
// vite-plugin-pwa diesen Listener automatisch ein - bei injectManifest (dieser Datei, siehe
// vite.config.ts) ist das unsere eigene Aufgabe. Ohne ihn tut der Button-Klick buchstäblich nichts.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
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
