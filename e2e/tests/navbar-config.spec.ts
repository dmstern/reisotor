import { test, expect } from '@playwright/test';

// Regressionsnetz für die konfigurierbare NavBar (Reihenfolge + Sichtbarkeit, siehe
// stores/navConfig.ts, SettingsView.vue).
test('hiding a nav entry in SettingsView removes it from the NavBar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('nav.navbar a', { hasText: 'Notizen' })).toBeVisible();

  await page.goto('/abc-123/settings?tab=app');
  const notesRow = page.locator('.nav-config-row', { hasText: 'Notizen' });
  await notesRow.locator('input[type="checkbox"]').uncheck();

  await page.goto('/');
  await expect(page.locator('nav.navbar a', { hasText: 'Notizen' })).toHaveCount(0);

  // Aufräumen, damit der Zustand nicht in andere Tests dieser Suite durchsickert.
  await page.goto('/abc-123/settings?tab=app');
  await page
    .locator('.nav-config-row', { hasText: 'Notizen' })
    .locator('input[type="checkbox"]')
    .check();
});

test('reordering nav entries in SettingsView changes their order in the NavBar', async ({
  page,
}) => {
  await page.goto('/abc-123/settings?tab=app');
  const firstRowLabel = page.locator('.nav-config-row').first().locator('.nav-config-label');
  const initialFirstLabel = await firstRowLabel.textContent();

  await page.locator('.nav-config-row').nth(1).getByLabel('Nach oben verschieben').click();

  const newFirstLabel = await page
    .locator('.nav-config-row')
    .first()
    .locator('.nav-config-label')
    .textContent();
  expect(newFirstLabel).not.toBe(initialFirstLabel);

  await page.goto('/');
  // :visible schließt den Kalender-Link aus (.mobile-page-link, per CSS nur <800px sichtbar,
  // Playwright läuft hier auf einem breiteren Default-Viewport, er bleibt aber im DOM vorhanden). Erst auf das
  // erste sichtbare Nav-Icon warten, damit allTextContents() nicht auf einer noch leeren/im Aufbau
  // befindlichen NavBar landet (allTextContents() selbst wartet nicht wie expect() automatisch).
  const navLinks = page.locator('nav.navbar .links .link:visible');
  await expect(navLinks.first()).toBeVisible();
  const navLabels = await navLinks.locator('.label').allTextContents();
  // "Übersicht" bleibt fix an erster Stelle, danach folgt jetzt der nach oben verschobene Eintrag.
  expect(navLabels[0]).toBe('Übersicht');
  expect(navLabels[1]?.trim()).toBe(newFirstLabel?.trim());

  // Aufräumen: wieder zurückverschieben.
  await page.goto('/abc-123/settings?tab=app');
  await page.locator('.nav-config-row').first().getByLabel('Nach unten verschieben').click();
});
