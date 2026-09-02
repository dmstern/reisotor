import { test, expect, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PASSWORD_2, E2E_USERNAME, E2E_USERNAME_2 } from '../constants.js';
import { newContextWithReducedMotion } from './helpers/context';

// Regressionsnetz für den Live-Standort auf der Karte (TripMap.vue/backend/src/activity.ts's
// updatePosition()/routes/realtime.ts's POST /realtime/position): sobald ein Mitglied mit erlaubtem
// Standortzugriff die Kartenansicht öffnet, soll dessen Standort-Marker bei den anderen gerade
// verbundenen Mitgliedern erscheinen – rein ephemer (siehe activity.ts), kein Nav-Badge/Push nötig.
//
// Zwei unabhängige Browser-Kontexte statt des "chromium"-Projekt-Storage-States, gleiches Muster wie
// realtime-sync.spec.ts (dessen storageState:authFile gilt sonst als Default für JEDEN
// browser.newContext()-Aufruf).
test('another member sharing their location shows up as a marker on the map', async ({
  browser,
}) => {
  const ctxA = await newContextWithReducedMotion(browser, {
    storageState: { cookies: [], origins: [] },
  });
  const ctxB = await newContextWithReducedMotion(browser, {
    storageState: { cookies: [], origins: [] },
    geolocation: { latitude: 48.2, longitude: 16.37 },
  });
  await ctxA.grantPermissions(['geolocation']);
  await ctxB.grantPermissions(['geolocation']);
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  async function login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(username);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('.trip-name').first()).toBeVisible();
  }

  await login(pageA, E2E_USERNAME, E2E_PASSWORD);
  await login(pageB, E2E_USERNAME_2, E2E_PASSWORD_2);

  // pageA never shares its own location - it should still see pageB's marker via SSE.
  await pageA.goto('/abc-123/excursions');
  const liveMarkersOnA = pageA.locator(
    '.leaflet-pane.leaflet-live-positions-pane .leaflet-marker-icon'
  );
  await expect(liveMarkersOnA).toHaveCount(0);

  await pageB.goto('/abc-123/excursions');
  await expect(liveMarkersOnA).toHaveCount(1, { timeout: 10_000 });

  // Leaving the map view stops sharing (DELETE /realtime/position on unmount) - the marker
  // disappears for pageA again.
  await pageB.goto('/');
  await expect(liveMarkersOnA).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});
