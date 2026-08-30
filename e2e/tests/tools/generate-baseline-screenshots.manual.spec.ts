import { test } from '@playwright/test';
import fs from 'node:fs';
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
  const bannerBuffer = fs.readFileSync(
    path.join(process.cwd(), '..', 'frontend', 'src', 'assets', 'demo-trip-banner.jpg')
  );

  for (const view of VIEWS) {
    test(`Capture screenshots for view: ${view.slug}`, async ({ page }) => {
      // Mock Open-Meteo weather forecast for rich weather data in all views
      await page.route('**/api.open-meteo.com/**', async (route) => {
        const mockWeather = {
          daily: {
            time: Array.from({ length: 16 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - 1 + i);
              return d.toISOString().slice(0, 10);
            }),
            weathercode: [0, 0, 1, 0, 2, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0],
            temperature_2m_max: [27, 28, 26, 29, 24, 28, 27, 30, 29, 25, 27, 28, 29, 30, 28, 27],
            temperature_2m_min: [18, 19, 18, 19, 17, 19, 18, 20, 19, 17, 18, 19, 20, 20, 19, 18],
            precipitation_probability_max: [5, 5, 10, 0, 20, 5, 10, 0, 0, 15, 5, 10, 0, 0, 5, 5],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockWeather),
        });
      });

      // Serve demo trip banner for map tiles and trip cover image requests
      await page.route('**/*.tile.openstreetmap.org/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/jpeg', body: bannerBuffer })
      );
      await page.route('**/maps.wikimedia.org/**', (route) =>
        route.fulfill({ status: 200, contentType: 'image/jpeg', body: bannerBuffer })
      );

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
          await page.waitForTimeout(400);

          const screenshotPath = path.join(
            process.cwd(),
            '..',
            'docs',
            'screenshots',
            `${view.slug}-${vp.name}-${theme}.png`
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
          `landing-${vp.name}-${theme}.png`
        );

        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    }
  });
});
