import { api } from '../api/client';

// "App ist jetzt offline verfügbar" (siehe PwaUpdatePrompt.vue) bezieht sich eigentlich nur auf die
// App-Shell (Workbox-Precaching, siehe vite.config.ts) - der Daten-Cache in api/offline.ts füllt
// sich sonst rein opportunistisch, GET für GET, während man online durch die App klickt. Ohne
// diese Liste blieben Views, die DashboardView.vue selbst nicht für seine eigenen Kacheln braucht
// (z. B. /budget/budgets+/transfers, *_likes/*_comments, /ideas), erst nach einem
// einmaligen Online-Besuch offline nutzbar - was die Nachricht im Header als leeres Versprechen
// erscheinen lässt. Deshalb hier bewusst die VOLLSTÄNDIGE Liste aller trip-bezogenen GET-Endpunkte
// über alle Views hinweg, nicht nur die von Dashboard tatsächlich benötigten.
//
// Bewusst NICHT dabei: Anhänge (/uploads/*) - die hängen an einzelnen Objekt-ids und lassen sich
// ohne bekannte id-Liste nicht sinnvoll pauschal vorababrufen; ebenso Realtime/Suche/Trip-Activity
// (siehe UNCACHEABLE_PREFIXES in api/offline.ts - würden ohnehin nicht gecacht).
function tripDataPaths(tripId: number): string[] {
  return [
    `/schedule?trip_id=${tripId}`,
    `/todos?trip_id=${tripId}`,
    `/packing?trip_id=${tripId}`,
    `/shopping?trip_id=${tripId}`,
    `/budget?trip_id=${tripId}`,
    `/budget/budgets?trip_id=${tripId}`,
    `/budget/allocations?trip_id=${tripId}`,
    `/budget/transfers?trip_id=${tripId}`,
    `/travel?trip_id=${tripId}`,
    `/diary?trip_id=${tripId}`,
    `/diary/likes?trip_id=${tripId}`,
    `/diary/comments?trip_id=${tripId}`,
    `/notes?trip_id=${tripId}`,
    `/notes/likes?trip_id=${tripId}`,
    `/notes/comments?trip_id=${tripId}`,
    `/ideas?trip_id=${tripId}`,
    `/ideas/likes?trip_id=${tripId}`,
    `/ideas/comments?trip_id=${tripId}`,
    `/spots?trip_id=${tripId}`,
    `/spots/likes?trip_id=${tripId}`,
    `/spots/comments?trip_id=${tripId}`,
    '/users',
  ];
}

/** Feuert alle GET-Endpunkte eines Urlaubs im Hintergrund ab, damit api/client.ts's automatisches
 *  writeCache() (siehe dort) sie in den Offline-Lese-Cache schreibt - Ergebnis wird bewusst
 *  ignoriert, ein Fehlschlag pro Pfad (z. B. gerade doch offline) wird verschluckt statt die App zu
 *  stören. Nicht awaited vom Aufrufer - reiner Cache-Warmup nebenbei. */
export function prefetchTripDataForOffline(tripId: number): void {
  for (const path of tripDataPaths(tripId)) {
    api.get(path).catch(() => {
      // Best-Effort - siehe Kommentar oben.
    });
  }
}
