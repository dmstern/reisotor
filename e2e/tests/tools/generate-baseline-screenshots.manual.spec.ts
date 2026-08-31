import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { forceFontDisplayBlock, waitForAppReady } from '../helpers/fonts.js';

async function saveScreenshotIfChanged(
  page: Page,
  screenshotPath: string,
  options: { fullPage?: boolean; maxDiffPixels?: number } = {}
): Promise<{ status: 'created' | 'updated' | 'unchanged'; diffPixels?: number }> {
  const { fullPage = false, maxDiffPixels = 5 } = options;
  const newBuffer = await page.screenshot({ fullPage });

  if (!fs.existsSync(screenshotPath)) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, newBuffer);
    console.log(`[Created] ${path.basename(screenshotPath)}`);
    return { status: 'created' };
  }

  try {
    const existingBuffer = fs.readFileSync(screenshotPath);
    const img1 = PNG.sync.read(existingBuffer);
    const img2 = PNG.sync.read(newBuffer);

    if (img1.width !== img2.width || img1.height !== img2.height) {
      fs.writeFileSync(screenshotPath, newBuffer);
      console.log(`[Updated: dimensions changed] ${path.basename(screenshotPath)}`);
      return { status: 'updated' };
    }

    const numDiffPixels = pixelmatch(img1.data, img2.data, null, img1.width, img1.height, {
      threshold: 0.1,
    });

    if (numDiffPixels > maxDiffPixels) {
      fs.writeFileSync(screenshotPath, newBuffer);
      console.log(`[Updated: ${numDiffPixels} px diff] ${path.basename(screenshotPath)}`);
      return { status: 'updated', diffPixels: numDiffPixels };
    } else {
      console.log(`[Unchanged: ${numDiffPixels} px diff] ${path.basename(screenshotPath)}`);
      return { status: 'unchanged', diffPixels: numDiffPixels };
    }
  } catch {
    fs.writeFileSync(screenshotPath, newBuffer);
    console.log(`[Updated: fallback] ${path.basename(screenshotPath)}`);
    return { status: 'updated' };
  }
}

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
      // 1. Intercept trip API calls to set start_date=today, end_date=today+9 (10 days total), and image_url='/demo/lissabon.jpg'
      await page.route('**/api/trips*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        const today = new Date();
        const sDate = today.toISOString().slice(0, 10);
        const endDateObj = new Date(today);
        endDateObj.setDate(endDateObj.getDate() + 9);
        const eDate = endDateObj.toISOString().slice(0, 10);

        if (Array.isArray(json)) {
          for (const t of json) {
            if (t.id === 1) {
              t.start_date = sDate;
              t.end_date = eDate;
              t.image_url = '/demo/lissabon.jpg';
            }
          }
        } else if (json && typeof json === 'object') {
          if (json.id === 1) {
            json.start_date = sDate;
            json.end_date = eDate;
            json.image_url = '/demo/lissabon.jpg';
          }
        }
        await route.fulfill({ json });
      });

      // 2. Mock Open-Meteo weather forecast with 16 days of varied, realistic weather (spanning all 10 trip days)
      await page.route('**/api.open-meteo.com/**', async (route) => {
        const today = new Date();
        const mockWeather = {
          daily: {
            time: Array.from({ length: 16 }, (_, i) => {
              const d = new Date(today);
              d.setDate(d.getDate() - 1 + i);
              return d.toISOString().slice(0, 10);
            }),
            weathercode: [0, 0, 1, 0, 2, 1, 0, 0, 2, 1, 0, 0, 1, 0, 0, 1],
            temperature_2m_max: [27, 28, 26, 29, 25, 27, 28, 30, 26, 27, 28, 29, 27, 28, 29, 27],
            temperature_2m_min: [18, 19, 18, 19, 17, 18, 19, 20, 18, 18, 19, 20, 19, 19, 18, 18],
            precipitation_probability_max: [5, 5, 10, 0, 20, 10, 5, 0, 15, 10, 5, 0, 10, 5, 0, 5],
          },
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockWeather),
        });
      });

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
          await page.emulateMedia({ colorScheme: theme });
          await page.evaluate((t) => {
            localStorage.setItem('reisotor-theme', t);
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

          await saveScreenshotIfChanged(page, screenshotPath, { fullPage: false });
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
        await page.emulateMedia({ colorScheme: theme });
        await page.evaluate((t) => {
          localStorage.setItem('reisotor-theme', t);
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

        await saveScreenshotIfChanged(page, screenshotPath, { fullPage: false });
      }
    }
  });
});
