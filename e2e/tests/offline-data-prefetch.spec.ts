import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8')
);

// Regressionstest für einen vom Nutzer gemeldeten Bug: die "App ist jetzt offline verfügbar"-
// Meldung (PwaUpdatePrompt.vue) suggeriert, dass sämtliche Urlaubsdaten offline nutzbar sind - der
// Daten-Cache (api/offline.ts) füllte sich vorher aber rein opportunistisch, GET für GET, während
// man online durch die App klickt. Views, die DashboardView.vue selbst nicht für seine eigenen
// Kacheln lädt (u. a. Budget, das zusätzlich /budget/budgets und /budget/transfers braucht;
// Tagebuch/Notizen/Touren, die zusätzlich ihre
// */likes und */comments brauchen), blieben dadurch erst nach einem einmaligen Online-Besuch
// offline nutzbar. Fix: App.vue wärmt den Daten-Cache für den kompletten Urlaub im Hintergrund vor
// (utils/offlinePrefetch.ts), sobald ein Urlaub geladen ist.
//
// Prüft den Cache-Inhalt direkt (localStorage) statt eine echte Offline-Navigation zu diesen Views
// durchzuspielen: eine Navigation zu einer in dieser Browser-Session noch nie geladenen Route
// bräuchte zusätzlich deren Vue-Router-Lazy-Chunk per dynamischem import() - ein separates,
// unabhängiges Thema (Workbox-Precaching von Code-Split-Chunks), das mit diesem Daten-Cache-Fix
// nichts zu tun hat und hier bewusst nicht mitgetestet wird.
test('wärmt beim Laden des Urlaubs den Offline-Cache für alle Domänen vor, nicht nur die vom Dashboard selbst benötigten', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('.trip-name');

  const tripId = seeded.trip.id;
  const uncoveredByDashboard = [
    `/budget/budgets?trip_id=${tripId}`,
    `/budget/transfers?trip_id=${tripId}`,
    `/diary/likes?trip_id=${tripId}`,
    `/diary/comments?trip_id=${tripId}`,
    `/notes/likes?trip_id=${tripId}`,
    `/notes/comments?trip_id=${tripId}`,
    `/ideas?trip_id=${tripId}`,
    `/ideas/likes?trip_id=${tripId}`,
    `/ideas/comments?trip_id=${tripId}`,
  ];

  // prefetchTripDataForOffline() feuert diese Requests unawaited im Hintergrund ab (siehe dort) -
  // statt auf 'networkidle' zu warten (von Playwright bei Apps mit langlebiger Verbindung wie
  // unserem SSE-Stream für den Echtzeit-Sync explizit als unzuverlässig dokumentiert, siehe
  // https://playwright.dev/docs/actionability#networkidle) direkt auf den erwarteten
  // localStorage-Cache-Zustand pollen.
  for (const path of uncoveredByDashboard) {
    await expect
      .poll(
        async () =>
          page.evaluate((p) => localStorage.getItem(`reisotor-cache:${p}`) !== null, path),
        { message: `${path} sollte im Offline-Cache liegen`, timeout: 10_000 }
      )
      .toBe(true);
  }
});
