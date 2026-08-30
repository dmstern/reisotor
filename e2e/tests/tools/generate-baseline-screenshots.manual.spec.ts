import { test } from '@playwright/test';
import path from 'node:path';
import { forceFontDisplayBlock, waitForAppReady } from '../helpers/fonts.js';

const VIEWS = [
  { slug: 'dashboard', path: '/' },
  { slug: 'trips', path: '/trips' },
  { slug: 'lists', path: '/listen' },
  { slug: 'spots', path: '/excursions' },
  { slug: 'calendar', path: '/calendar' },
  { slug: 'budget', path: '/budget' },
  { slug: 'notes', path: '/notes' },
  { slug: 'diary', path: '/diary' },
  { slug: 'settings', path: '/settings' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 390, height: 844 },
];

const THEMES = ['light', 'dark'] as const;

test.describe('Generate Clean Production Baseline Screenshots (Full HD)', () => {
  for (const view of VIEWS) {
    test(`Capture screenshots for view: ${view.slug}`, async ({ page }) => {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await forceFontDisplayBlock(page);
        await page.goto(view.path);
        await waitForAppReady(page);

        // Hide dev elements, banners, install/offline pills, and splash overlays for clean marketing screenshots
        await page.addStyleTag({
          content: `
            .demo-banner,
            .pwa-pill,
            .dev-badge,
            .environment-badge,
            #splash,
            .splash {
              display: none !important;
            }
            .app-header.non-prod {
              border-bottom: none !important;
              box-shadow: none !important;
            }
          `,
        });

        for (const theme of THEMES) {
          await page.evaluate((t) => {
            document.documentElement.setAttribute('data-theme', t);
          }, theme);
          await page.waitForTimeout(300);

          const screenshotPath = path.join(
            process.cwd(),
            '..',
            'docs',
            'screenshots',
            view.slug,
            `${vp.name}-${theme}.png`
          );

          await page.screenshot({ path: screenshotPath, fullPage: false });
        }
      }
    });
  }

  test('Capture screenshots for landing page', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await forceFontDisplayBlock(page);
      await page.goto('/landing.html');
      await page.waitForTimeout(500);

      await page.addStyleTag({
        content: `
          .demo-banner,
          .pwa-pill,
          .dev-badge,
          .environment-badge,
          #splash,
          .splash {
            display: none !important;
          }
        `,
      });

      for (const theme of THEMES) {
        await page.evaluate((t) => {
          document.documentElement.setAttribute('data-theme', t);
        }, theme);
        await page.waitForTimeout(300);

        const screenshotPath = path.join(
          process.cwd(),
          '..',
          'docs',
          'screenshots',
          'landing',
          `${vp.name}-${theme}.png`
        );

        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    }
  });
});
