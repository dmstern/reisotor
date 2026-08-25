import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8')
);

// Regressionstest für einen vom Nutzer gemeldeten Bug: praktisch jede Domänen-View folgt dem Muster
// "const [...] = await Promise.all([...]); ...; loading.value = false" ohne jedes Fehler-Handling.
// Schlägt auch nur EINER der parallelen Endpunkte fehl (z. B. weil der Offline-Prefetch, siehe
// utils/offlinePrefetch.ts, für genau diesen Pfad noch nicht durchgelaufen war, bevor die Verbindung
// wegbrach), lehnt Promise.all komplett ab - "loading.value = false" wird nie erreicht, die Seite
// bleibt wegen v-if="!loading" für immer eine leere Fläche, ganz ohne Fehlermeldung. Fix: try/catch/
// finally in jeder betroffenen View (siehe api/client.ts's Offline-Fallback-Konzept).
test('rendert die Seite auch, wenn der Cache für einen ihrer Endpunkte fehlt, statt für immer leer zu bleiben', async ({
  page,
}) => {
  await page.goto('/todo');
  await expect(page.locator('.todo-page')).toBeVisible();

  // Genau den einen Cache-Eintrag entfernen (Rest der App bleibt online/gecacht) und den
  // zugehörigen Netzwerk-Request hart scheitern lassen - simuliert einen echten, isolierten
  // Cache-Miss statt eines kompletten Verbindungsabbruchs.
  await page.evaluate((tripId) => {
    localStorage.removeItem(`reisotor-cache:/todos?trip_id=${tripId}`);
  }, seeded.trip.id);
  await page.route(`**/api/todos?trip_id=${seeded.trip.id}`, (route) => route.abort());

  await page.reload();

  await expect(page.locator('.todo-page')).toBeVisible({ timeout: 10_000 });
});
