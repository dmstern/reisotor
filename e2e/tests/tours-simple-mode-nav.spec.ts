import { test, expect } from '@playwright/test';

// Regressionstest für den Standard-("einfachen") Touren-Modus (stores/tourSettings.ts): Touren
// anlegen/Spots zuordnen geht dort bereits direkt in der Karte-Hauptsicht per "Tour zuordnen"
// (TourAssignPicker.vue, siehe tour-assignment.spec.ts) - der zusätzliche "Touren"-Nav-Punkt (mobil)
// bzw. die "Touren"-Lasche (Desktop) wären in diesem Modus nur redundante Navigation und werden
// deshalb ausgeblendet (NavBar.vue/App.vue). Die Route/Schublade selbst bleiben trotzdem
// erreichbar - das deckt bereits tour-assignment.spec.ts indirekt ab (Bearbeiten-Flows), hier geht
// es nur um die Sichtbarkeit der Einstiegspunkte.
test.describe('Touren-Navigation folgt dem einfachen/erweiterten Modus', () => {
  test('Desktop: "Touren"-Lasche nur bei aktivierter erweiterter Bearbeitung sichtbar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.trip-name').first()).toBeVisible();

    await expect(page.locator('.drawer-tab[aria-label*="Touren"]')).toHaveCount(0);

    // .drawer.open .drawer-tab blendet die Lasche unabhängig vom Touren-Modus aus, solange die
    // Schublade schon offen ist (kein Grund, eine Lasche zum Öffnen zu zeigen, wenn schon offen) -
    // für die eigentliche Prüfung hier (Lasche sichtbar bei erweiterter Bearbeitung) muss die
    // Schublade also geschlossen sein, unabhängig davon, welchen Zustand ein vorheriger Testlauf im
    // gemeinsamen storageState hinterlassen hat.
    await page.evaluate(() => {
      localStorage.setItem('reisotor-tour-advanced-editing', 'true');
      localStorage.setItem('reisotor-drawer-excursions-open', 'false');
    });
    await page.reload();
    await expect(page.locator('.trip-name').first()).toBeVisible();
    await expect(page.locator('.drawer-tab[aria-label*="Touren"]')).toBeVisible();
  });

  test('Mobil: "Touren"-Nav-Punkt nur bei aktivierter erweiterter Bearbeitung sichtbar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.trip-name').first()).toBeVisible();

    await expect(page.getByRole('link', { name: 'Touren' })).toHaveCount(0);

    await page.evaluate(() => localStorage.setItem('reisotor-tour-advanced-editing', 'true'));
    await page.reload();
    await expect(page.locator('.trip-name').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Touren' })).toBeVisible();
  });
});
