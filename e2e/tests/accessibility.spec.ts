import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated Accessibility (a11y) Tests using Axe.
 *
 * Runs accessibility checks across core application pages.
 * By default, all WCAG 2.0 / 2.1 AA rules (including color contrast) are verified.
 */

async function scanPageA11y(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(r));
      const finiteAnims = document.getAnimations().filter((a) => {
        const it = a.effect?.getTiming()?.iterations;
        return it !== Infinity && it !== undefined;
      });
      await Promise.allSettled(finiteAnims.map((a) => a.finished));
    })
    .catch(() => {});

  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
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
      await expect(page.locator('.animate-cascade-children > *:last-child')).toBeVisible();

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });

    test('calendar page accessibility scan', async ({ page }) => {
      await page.goto('/calendar');
      const tab = page.locator('.drawer-tab[aria-label*="Kalender"]');
      if ((await tab.count()) > 0 && (await tab.getAttribute('aria-expanded')) === 'false') {
        await tab.click();
      }
      await expect(
        page.getByRole('heading', { name: 'Kalender', exact: true, level: 2 })
      ).toBeVisible();

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
      await expect(page.getByRole('heading', { name: 'Einstellungen', level: 1 })).toBeVisible({
        timeout: 15_000,
      });

      const results = await scanPageA11y(page);
      expect(results.violations, formatViolations(results.violations)).toEqual([]);
    });
  });
});
