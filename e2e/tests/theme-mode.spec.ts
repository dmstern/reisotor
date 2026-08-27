import { test, expect } from '@playwright/test';

// Regressionstest für die dritte Theme-Option "Systemeinstellung" (stores/theme.ts): vorher konnte
// explicitMode nur 'light'/'dark' sein, mit einem reinen Icon-Toggle-Button (theme.toggle()) ohne
// Weg, einmal explizit gesetzte Präferenz wieder auf "folgt der Geräteeinstellung" zurückzusetzen.
// Jetzt ein <select> mit drei Optionen (components/ThemeModeSelect.vue), persistiert wie zuvor unter
// localStorage['reisotor-theme'].
test.describe('Erscheinungsbild: Hell/Dunkel/Systemeinstellung', () => {
  test('Auswahl in den Einstellungen setzt data-theme und persistiert über einen Reload', async ({ page }) => {
    await page.goto('/settings?tab=app');
    const select = page.locator('.card', { hasText: 'Darstellung' }).locator('select');
    await expect(select).toBeVisible();

    await select.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await select.selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // "Systemeinstellung" entfernt das Attribut wieder komplett, statt es auf einen dritten Wert zu
    // setzen - die tatsächlichen Farben übernimmt dann die @media(prefers-color-scheme)-Regel in
    // style.css, siehe stores/theme.ts's apply().
    await select.selectOption('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');

    await page.reload();
    const reloadedSelect = page.locator('.card', { hasText: 'Darstellung' }).locator('select');
    await expect(reloadedSelect).toHaveValue('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });

  test.describe('nicht angemeldet', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('die Auswahl funktioniert auch auf der Login-Seite', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('.login-card')).toBeVisible();
      const select = page.locator('.theme-toggle select');
      await select.selectOption('dark');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });
  });
});
