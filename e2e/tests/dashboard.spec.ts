import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'),
);

test.describe('unauthenticated', () => {
  // Überschreibt den storageState des chromium-Projekts (eingeloggt) nur für diesen einen Test —
  // testet den Router-Guard selbst (frontend/src/router/index.ts).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();
  });
});

test('logged-in dashboard shows the seeded trip, not onboarding', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Willkommen bei Reisotor!')).toHaveCount(0);
  // .trip-name (Header-Trip-Auswahl) statt getByText(...) — der Trip-Name taucht auf einem frisch
  // geladenen Dashboard mit offener Kalender-Schublade mehrfach auf (Header + synthetische
  // "Urlaub-Start"/"Urlaub-Ende"-Kalendereinträge in der Mini-Vorschau).
  await expect(page.locator('.trip-name', { hasText: seeded.trip.name })).toBeVisible();
  // .tile-btn statt getByRole('button', {name: /Kalender/}) — die Kalender-Schublade ist auf
  // Desktop standardmäßig bereits offen (siehe drawers.ts loadOpen/isDesktop) und deren eigene
  // Maximieren-/Schließen-Buttons enthalten "Kalender" ebenfalls im Accessible Name (strict-mode-
  // Kollision), siehe DashboardView.vue: <button class="tile tile-btn">...<h3>Kalender</h3>.
  await expect(page.locator('.tile-btn', { hasText: 'Kalender' })).toBeVisible();
});

test('the dashboard tile opens the calendar drawer', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { name: 'Kalender', exact: true, level: 2 });

  // Schublade ist auf Desktop initial schon offen — erst schließen, um den Öffnen-Pfad über die
  // Dashboard-Kachel überhaupt sinnvoll zu testen. Drawer.vue blendet per CSS-Transition aus
  // (bleibt im DOM, siehe .drawer-tab) — daher toBeHidden() statt toHaveCount(0).
  await page.getByRole('button', { name: 'Schließen: Kalender' }).click();
  await expect(heading).toBeHidden();

  await page.locator('.tile-btn', { hasText: 'Kalender' }).click();
  await expect(heading).toBeVisible();
});

test.describe('Reiseregion-Widget (kombiniert mit Wetter)', () => {
  // Regressionstest für einen vom Nutzer gemeldeten Bug: die Card zeigte bei teilweise/komplett
  // leeren Regionsdaten trotzdem ihre Überschrift + eine pauschale Quellenangabe für alle drei
  // externen Dienste, unabhängig davon, ob diese tatsächlich etwas beigetragen hatten. Fix in
  // DashboardView.vue: Überschrift/Quelle erscheinen nur, wenn wirklich eine Detailzeile gezeigt
  // wird, und die Quellenangabe nennt nur die Dienste, die tatsächlich Daten geliefert haben.
  // Gemockt statt echter REST-Countries-/Wechselkurs-Antwort — deterministisch und unabhängig von
  // externen Diensten, ähnlich wie es für Wetter/Region in dieser Suite bisher nicht existiert.

  test('nennt nur Quellen, die tatsächlich Daten beigetragen haben', async ({ page }) => {
    await page.route('**/api/trips/*/region-info*', (route) =>
      route.fulfill({
        json: {
          countryName: 'Testland',
          languages: [],
          currency: { code: 'TST', name: 'Testwährung' },
          exchangeRate: null,
          advisory: null,
        },
      }),
    );
    await page.goto('/');
    const card = page.locator('.weather-card');
    await expect(card.getByText('🌍 Reiseregion')).toBeVisible();
    await expect(card.getByText('💱 Testwährung (TST)')).toBeVisible();
    // Kein Wechselkurs in den Mock-Daten -> keine Nennung/Verlinkung von open.er-api.com.
    await expect(card.locator('.weather-source', { hasText: 'REST Countries' })).toHaveText('Quelle: REST Countries');
    await expect(page.locator('a.weather-source', { hasText: 'REST Countries' })).toHaveCount(0);
  });

  test('blendet die Reiseregion komplett aus, wenn das Land zwar aufgelöst wurde, aber keine der Detailzeilen etwas hat', async ({ page }) => {
    // Der eigentliche gemeldete Fall: countryName war gesetzt (die alte v-else-if-Bedingung griff
    // auf genau dieses Feld), Sprache/Währung/Sicherheitshinweis aber alle leer - übrig blieb nur
    // eine Überschrift mit Ländernamen plus eine pauschale Quellenangabe ohne jeden Inhalt darüber.
    await page.route('**/api/trips/*/region-info*', (route) =>
      route.fulfill({
        json: { countryName: 'Testland', languages: [], currency: null, exchangeRate: null, advisory: null },
      }),
    );
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Kalender', exact: true, level: 2 })).toBeVisible();
    await expect(page.getByText('🌍 Reiseregion')).toHaveCount(0);
    await expect(page.getByText('Testland')).toHaveCount(0);
  });
});
