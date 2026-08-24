import { test, expect } from '@playwright/test';

// Regressionsnetz für die konfigurierbaren Dashboard-Kacheln (Reihenfolge + Sichtbarkeit, siehe
// stores/dashboardConfig.ts, SettingsView.vue) - 1:1 dasselbe Testmuster wie navbar-config.spec.ts
// für die NavBar-Konfiguration, hier gegen .dashboard-config-row statt .nav-config-row (eigene
// Klasse, damit beide Listen trotz teils gleicher Eintrags-Namen wie "Notizen" nicht kollidieren).
test('hiding a dashboard tile in SettingsView removes it from the Dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.grid.cards .tile h3', { hasText: 'Notizen' })).toBeVisible();

  await page.goto('/settings?tab=app');
  const notesRow = page.locator('.dashboard-config-row', { hasText: 'Notizen' });
  await notesRow.locator('input[type="checkbox"]').uncheck();

  await page.goto('/');
  await expect(page.locator('.grid.cards .tile h3', { hasText: 'Notizen' })).toHaveCount(0);

  // Aufräumen, damit der Zustand nicht in andere Tests dieser Suite durchsickert.
  await page.goto('/settings?tab=app');
  await page.locator('.dashboard-config-row', { hasText: 'Notizen' }).locator('input[type="checkbox"]').check();
});

test('reordering dashboard tiles in SettingsView changes their order on the Dashboard', async ({ page }) => {
  await page.goto('/settings?tab=app');
  const firstRowLabel = page.locator('.dashboard-config-row').first().locator('.nav-config-label');
  const initialFirstLabel = await firstRowLabel.textContent();

  await page.locator('.dashboard-config-row').nth(1).getByLabel('Nach oben verschieben').click();

  const newFirstLabel = await page.locator('.dashboard-config-row').first().locator('.nav-config-label').textContent();
  expect(newFirstLabel).not.toBe(initialFirstLabel);

  await page.goto('/');
  const tileHeadings = page.locator('.grid.cards .tile h3');
  await expect(tileHeadings.first()).toBeVisible();
  const tileLabels = await tileHeadings.allTextContents();
  expect(tileLabels[0]?.trim()).toBe(newFirstLabel?.trim());

  // Aufräumen: wieder zurückverschieben.
  await page.goto('/settings?tab=app');
  await page.locator('.dashboard-config-row').first().getByLabel('Nach unten verschieben').click();
});
