import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated Accessibility (a11y) Tests using Axe.
 *
 * Runs accessibility checks across core application pages.
 * By default, rules are configured to report violations.
 * To focus automated checks on critical structural ARIA / HTML / Label issues,
 * color contrast checks are excluded by default, but can be enabled on-demand
 * via CHECK_CONTRAST=1 (e.g. `npm run test:a11y:contrast`).
 */

const checkContrast = Boolean(process.env.CHECK_CONTRAST);

async function scanPageA11y(page: Page) {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (!checkContrast) {
    builder.disableRules(['color-contrast']);
  }
  return builder.analyze();
}

function formatViolations(
  violations: Array<{
    id: string;
    help: string;
    helpUrl?: string;
    impact?: string | null;
    nodes: Array<{ target: unknown; failureSummary?: string }>;
  }>
) {
  if (!violations || violations.length === 0) return '';
  return violations
    .map(
      (v) =>
        `[${v.impact ? v.impact.toUpperCase() : 'INFO'}] ${v.id}: ${v.help} (${v.helpUrl ?? ''})\n` +
        v.nodes
          .map(
            (n) =>
              `  - Target: ${Array.isArray(n.target) ? n.target.join(', ') : String(n.target)}\n    Summary: ${n.failureSummary ? n.failureSummary.replace(/\n/g, '\n    ') : ''}`
          )
          .join('\n')
    )
    .join('\n\n');
}

test.describe('Accessibility (a11y)', () => {
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('login page accessibility scan', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible();

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  });

  test.describe('authenticated views', () => {
    test('dashboard page accessibility scan', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.tile-btn', { hasText: 'Kalender' })).toBeVisible();

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });

    test('calendar page accessibility scan', async ({ page }) => {
      await page.goto('/calendar');
      await expect(page.getByRole('heading', { name: 'Kalender' })).toBeVisible();

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });

    test('excursions (spots) page accessibility scan', async ({ page }) => {
      await page.goto('/trip/1/excursions');
      await expect(
        page.getByRole('button', { name: 'Nach Kategorie filtern', exact: true })
      ).toBeVisible({ timeout: 15_000 });

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });

    test('settings page accessibility scan', async ({ page }) => {
      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible();

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  });
});
