import { test, expect } from '@playwright/test';

// Regressionstest für einen vom Nutzer gemeldeten Bug: auf einem instabilen Netz (WLAN/Mobilfunk
// "verbunden", aber der Server antwortet nie - anders als ein sauberer, sofortiger Verbindungsabbruch
// wie bei context.setOffline()) hing ein GET-Request in api/client.ts unbegrenzt lange. fetch() ohne
// eigenes Timeout wirft in diesem Fall NIE den TypeError, auf den isNetworkFailure() prüft - die
// betroffene View blieb dadurch dauerhaft im (leeren) Ladezustand hängen statt auf den bereits
// vorhandenen Offline-Cache (api/offline.ts) zurückzufallen, obwohl navigator.onLine weiterhin true
// meldet. Fix: fetchWithTimeout() in api/client.ts bricht nach REQUEST_TIMEOUT_MS per
// AbortController ab; isNetworkFailure() erkennt den resultierenden AbortError zusätzlich zum
// TypeError als Offline-Fall.
test('fällt bei einem hängenden (nie antwortenden) Request auf den Cache zurück statt dauerhaft leer zu bleiben', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForSelector('.trip-name');
  const tripName = await page.locator('.trip-name').textContent();
  expect(tripName).toBeTruthy();

  // Route registriert, aber weder fulfill() noch continue() noch abort() aufgerufen - der Request
  // bleibt absichtlich für immer "pending", simuliert damit exakt das gemeldete Verhalten (Netz da,
  // Server antwortet aber nicht) statt eines sauberen, sofortigen Fehlschlags.
  await page.route('**/api/trips', () => {});
  await page.reload();

  // Innerhalb der ersten Sekunden noch kein neuer Trip-Name (Request hängt), nach dem intern
  // konfigurierten Timeout (8s, siehe REQUEST_TIMEOUT_MS in api/client.ts) muss der Cache-Fallback
  // greifen und denselben, zuvor gecachten Namen wieder anzeigen.
  await expect(page.locator('.trip-name')).toHaveText(tripName ?? '', { timeout: 12_000 });
});
