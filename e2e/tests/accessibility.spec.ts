import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated Accessibility (a11y) Tests using Axe.
 *
 * Runs accessibility checks across core application pages.
 * By default, rules are configured to report violations.
 * To focus automated checks on critical structural ARIA / HTML / Label issues,
 * color contrast checks can be excluded or reviewed separately.
 */

test.describe('Accessibility (a11y)', () => {
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page accessibility scan', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  });

  test.describe('authenticated views', () => {
    test('dashboard page accessibility scan', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.tile-btn', { hasText: 'Kalender' })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('calendar page accessibility scan', async ({ page }) => {
      await page.goto('/abc-123/calendar');
      await expect(page.getByRole('heading', { name: 'Kalender', level: 2 })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('excursions (spots) page accessibility scan', async ({ page }) => {
      await page.goto('/abc-123/excursions');
      await expect(
        page.getByRole('button', { name: 'Nach Kategorie filtern', exact: true })
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test('settings page accessibility scan', async ({ page }) => {
      await page.goto('/abc-123/settings');
      await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  });
});
