import { test, expect, type Page } from '@playwright/test';
import { VIEWPORTS } from './helpers/layout';

// Regressionstest für die Standort-Freigabe-Dauer (Nutzer-Feedback: bisher sah man andere
// Mitglieder nur, solange diese selbst gerade die Kartenansicht offen hatten). Prüft nur den
// UI-Ablauf (Button -> Menü -> Auswahl -> Persistenz über einen Seiten-Reload hinweg) - die
// eigentliche Dauer-Berechnung (Tag/Woche/dauerhaft als Ablaufzeitpunkt) ist bereits im Backend
// per Unit-Test abgedeckt (backend/test/unit/locationShare.test.ts). Etwas höherer Viewport als der
// Standard: die Spots-Sheet-Überlagerung am unteren Kartenrand (TripMap.vue/ExcursionsView.vue)
// nimmt eine feste Pixelhöhe ein, die bei der Default-Höhe sonst den untersten Button der
// Steuerelement-Spalte (share-location-btn) verdeckt.
test.use({
  geolocation: { latitude: 48.2, longitude: 16.37 },
  permissions: ['geolocation'],
  viewport: VIEWPORTS.desktop,
});

// Die Kalender-Schublade kann aus einem vorherigen Test heraus offen bleiben (Zustand landet via
// localStorage im gemeinsamen storageState, gleiches bekanntes Muster wie in
// calendar-week-start.spec.ts) - offen wird die Karte so schmal/niedrig, dass der unten in der
// Button-Spalte sitzende Freigabe-Button vom Spots-Bottom-Sheet überdeckt wird. Explizit schließen
// statt sich auf einen zufällig "sauberen" Ausgangszustand zu verlassen.
async function closeDrawerIfOpen(page: Page, label: string) {
  const closeBtn = page.locator(`.close-drawer-btn[aria-label="Schließen: ${label}"]`);
  if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible())) {
    await closeBtn.click();
  }
}

test.describe('Standort-Freigabe-Dauer auf der Karte', () => {
  test('Auswahl "Für einen Tag" markiert den Button als aktiv und übersteht einen Reload', async ({
    page,
  }) => {
    await page.goto('/excursions');
    await closeDrawerIfOpen(page, 'Kalender');
    const shareBtn = page.locator('.share-location-btn');
    await expect(shareBtn).toBeVisible({ timeout: 10_000 });
    await expect(shareBtn).not.toHaveClass(/active/);

    await shareBtn.click();
    const menu = page.locator('.picker-menu', { hasText: 'Für einen Tag' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Für einen Tag' }).click();

    await expect(shareBtn).toHaveClass(/active/);

    // Übersteht einen Reload, da serverseitig persistiert (trip_members.location_share_until),
    // nicht nur clientseitiger Ansichtszustand - genau der Kern der Anforderung ("auch ohne offene
    // Kartenansicht weiter teilen").
    await page.reload();
    await expect(page.locator('.share-location-btn')).toHaveClass(/active/, { timeout: 10_000 });
  });

  test('Auswahl "Nicht teilen" deaktiviert die Freigabe wieder', async ({ page }) => {
    await page.goto('/excursions');
    await closeDrawerIfOpen(page, 'Kalender');
    const shareBtn = page.locator('.share-location-btn');
    await expect(shareBtn).toBeVisible({ timeout: 10_000 });

    await shareBtn.click();
    await page.locator('.picker-menu').getByRole('button', { name: 'Dauerhaft' }).click();
    await expect(shareBtn).toHaveClass(/active/);

    await shareBtn.click();
    await page.locator('.picker-menu').getByRole('button', { name: 'Nicht teilen' }).click();
    await expect(shareBtn).not.toHaveClass(/active/);
  });
});
