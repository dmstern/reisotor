import { test, expect } from '@playwright/test';

// Regressionstest für die dritte Theme-Option "Systemeinstellung" (stores/theme.ts): vorher konnte
// explicitMode nur 'light'/'dark' sein, mit einem reinen Icon-Toggle-Button (theme.toggle()) ohne
// Weg, einmal explizit gesetzte Präferenz wieder auf "folgt der Geräteeinstellung" zurückzusetzen.
// Jetzt ein <select> mit drei Optionen (components/ThemeModeSelect.vue), persistiert wie zuvor unter
// localStorage['reisotor-theme'].
test.describe('Erscheinungsbild: Hell/Dunkel/Systemeinstellung', () => {
  test('Auswahl im Header setzt data-theme und persistiert über einen Reload', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('.app-header .theme-toggle select');
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
    await expect(page.locator('.app-header .theme-toggle select')).toHaveValue('system');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
  });

  test('Profil-Einstellungen (mobile) und Header (Desktop) teilen sich dieselbe Präferenz', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await page.goto('/profile?tab=app');
    const profileSelect = page.locator('.card', { hasText: 'Darstellung' }).locator('select');
    await expect(profileSelect).toBeVisible();
    await profileSelect.selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    expect(await page.evaluate(() => localStorage.getItem('reisotor-theme'))).toBe('dark');
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
