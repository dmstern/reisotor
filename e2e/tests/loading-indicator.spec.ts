import { test, expect } from '@playwright/test';

// Regressionstest für die zentrale Lade-Animation (stores/requestActivity.ts,
// components/LoadingIndicator.vue, components/ViewLoadingState.vue): vorher gab es bei langsamen
// Requests keinerlei sichtbare Rückmeldung - eine View blieb bis zum ersten Response komplett leer,
// was wie ein Einfrieren der App wirkte.
test.describe('Zentrale Lade-Animation', () => {
  test('View-Wechsel zeigt einen Lade-Platzhalter statt einer leeren Seite', async ({ page }) => {
    await page.goto('/listen?tab=todo');
    await expect(page.locator('.todo-page')).toBeVisible();

    // Alle API-Antworten künstlich verzögern, um den Ladezustand sichtbar zu machen.
    await page.route('**/api/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });

    // Packliste/ToDo sind seit dem "Listen"-Merge Tabs derselben Route statt eigener Nav-Links
    // (siehe ListenView.vue) - ein Tab-Klick mountet die Ziel-Komponente aber weiterhin frisch
    // (v-if), triggert also denselben Ladezustand wie vorher ein echter Routenwechsel.
    await page.getByRole('tab', { name: 'Packliste' }).click();
    await expect(page.locator('.view-loading')).toBeVisible();
    await expect(page.locator('.view-loading .text')).toHaveText('Lädt…');

    await page.unroute('**/api/**');
    await expect(page.locator('.packing-page')).toBeVisible();
    await expect(page.locator('.view-loading')).toHaveCount(0);
  });

  test('Toast unterscheidet Lesen von Anlegen', async ({ page }) => {
    await page.goto('/packing');
    await expect(page.locator('.packing-page')).toBeVisible();

    await page.route('**/api/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });

    await page.locator('input[placeholder^="Neuer Gegenstand"]').first().fill('E2E-Testartikel');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).first().click();

    await expect(page.locator('.toast-pill.create')).toBeVisible();
    await expect(page.locator('.toast-pill.create .label')).toHaveText('Legt an…');
  });

  test('Toast lässt sich in den Profil-Einstellungen abschalten', async ({ page }) => {
    await page.goto('/profile');
    await page.getByLabel('Detaillierte Lade-/Speicher-Meldungen anzeigen').uncheck();

    await page.goto('/packing');
    await expect(page.locator('.packing-page')).toBeVisible();

    await page.route('**/api/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      await route.continue();
    });
    await page.locator('input[placeholder^="Neuer Gegenstand"]').first().fill('E2E-Testartikel-2');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).first().click();
    await page.waitForTimeout(600); // über SHOW_DELAY_MS (200ms) hinaus warten

    await expect(page.locator('.toast-pill')).toHaveCount(0);
  });
});
