import { test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { forceFontDisplayBlock, waitForAppReady, waitForMapTiles } from '../helpers/fonts.js';
import {
  SCREENSHOT_REFERENCE_DATE,
  SCREENSHOT_TRIP_DATES,
  SCREENSHOT_TODOS,
  SCREENSHOT_SCHEDULE,
  SCREENSHOT_BUDGET_EXPENSES,
  SCREENSHOT_BUDGET_TRANSFERS,
  SCREENSHOT_DIARY,
  SCREENSHOT_WEATHER,
} from '../../../frontend/src/demo/screenshotData.js';

const LANDING_SYNC_MAP: Record<string, string> = {
  'dashboard-desktop-light.png': 'screenshot-dashboard-light.png',
  'dashboard-desktop-dark.png': 'screenshot-dashboard-dark.png',
  'dashboard-mobile-light.png': 'screenshot-dashboard-mobile-light.png',
  'dashboard-mobile-dark.png': 'screenshot-dashboard-mobile-dark.png',
  'tour-desktop-light.png': 'screenshot-tour-light.png',
  'tour-desktop-dark.png': 'screenshot-tour-dark.png',
  'tour-mobile-light.png': 'screenshot-tour-mobile-light.png',
  'tour-mobile-dark.png': 'screenshot-tour-mobile-dark.png',
  'budget-desktop-light.png': 'screenshot-budget-light.png',
  'budget-desktop-dark.png': 'screenshot-budget-dark.png',
  'budget-mobile-light.png': 'screenshot-budget-mobile-light.png',
  'budget-mobile-dark.png': 'screenshot-budget-mobile-dark.png',
  'lists-desktop-light.png': 'screenshot-packing-light.png',
  'lists-desktop-dark.png': 'screenshot-packing-dark.png',
  'lists-mobile-light.png': 'screenshot-packing-mobile-light.png',
  'lists-mobile-dark.png': 'screenshot-packing-mobile-dark.png',
  'diary-desktop-light.png': 'screenshot-diary-light.png',
  'diary-desktop-dark.png': 'screenshot-diary-dark.png',
  'diary-mobile-light.png': 'screenshot-diary-mobile-light.png',
  'diary-mobile-dark.png': 'screenshot-diary-mobile-dark.png',
  'spots-desktop-light.png': 'screenshot-spots-light.png',
  'spots-desktop-dark.png': 'screenshot-spots-dark.png',
};

function syncToLandingIfMapped(screenshotPath: string) {
  const baseName = path.basename(screenshotPath);
  const targetLandingName = LANDING_SYNC_MAP[baseName];
  if (targetLandingName) {
    const landingPath = path.join(
      process.cwd(),
      '..',
      'frontend',
      'public',
      'landing',
      targetLandingName
    );
    fs.mkdirSync(path.dirname(landingPath), { recursive: true });
    fs.copyFileSync(screenshotPath, landingPath);
    console.log(`[Synced to landing] ${baseName} -> ${targetLandingName}`);
  }
}

async function saveScreenshotIfChanged(
  page: Page,
  screenshotPath: string,
  options: { fullPage?: boolean; maxDiffPixels?: number } = {}
): Promise<{ status: 'created' | 'updated' | 'unchanged'; diffPixels?: number }> {
  // Sicherheitsnetz: Falls Leaflet-Karten auf der Seite gerendert werden, darf NIEMALS ein Screenshot
  // mit unvollständigen oder noch ladenden Kacheln gespeichert werden.
  const hasIncompleteTiles = await page.evaluate(() => {
    const tiles = Array.from(
      document.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile')
    );
    if (tiles.length === 0) return false;
    return tiles.some(
      (img) =>
        !img.complete || img.naturalWidth === 0 || !img.classList.contains('leaflet-tile-loaded')
    );
  });
  if (hasIncompleteTiles) {
    throw new Error(
      `[Sicherheitsabbruch] Screenshot '${path.basename(screenshotPath)}' kann nicht gespeichert werden: Nicht alle Leaflet-Kartenkacheln wurden vollständig geladen/gerendert!`
    );
  }

  // Erhöhte Toleranz (25.000 Pixel entspricht ca. 1.2% bei Full HD), da Anti-Aliasing
  // und Font-Rendering zwischen macOS, Fedora und der CI (Ubuntu Jammy) zehntausende
  // Pixel minimal (Graustufen) abweichen lässt, selbst bei gleicher Fira-Sans-Schriftart.
  const { fullPage = false, maxDiffPixels } = options;
  const newBuffer = await page.screenshot({ fullPage, animations: 'disabled', caret: 'hide' });

  let result: { status: 'created' | 'updated' | 'unchanged'; diffPixels?: number };

  if (!fs.existsSync(screenshotPath)) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    fs.writeFileSync(screenshotPath, newBuffer);
    console.log(`[Created] ${path.basename(screenshotPath)}`);
    result = { status: 'created' };
  } else {
    try {
      const existingBuffer = fs.readFileSync(screenshotPath);
      const img1 = PNG.sync.read(existingBuffer);
      const img2 = PNG.sync.read(newBuffer);

      if (img1.width !== img2.width || img1.height !== img2.height) {
        fs.writeFileSync(screenshotPath, newBuffer);
        console.log(`[Updated: dimensions changed] ${path.basename(screenshotPath)}`);
        result = { status: 'updated' };
      } else {
        const numDiffPixels = pixelmatch(img1.data, img2.data, undefined, img1.width, img1.height, {
          threshold: 0.2,
        });

        const effectiveMaxDiff =
          maxDiffPixels ??
          (img1.width <= 500
            ? Math.max(300, Math.round(img1.width * img1.height * 0.012))
            : Math.round(img1.width * img1.height * 0.005));

        if (numDiffPixels > 0 && process.env.FORCE_SCREENSHOTS) {
          fs.writeFileSync(screenshotPath, newBuffer);
          console.log(
            `[Updated: ${numDiffPixels} px diff (forced)] ${path.basename(screenshotPath)}`
          );
          result = { status: 'updated', diffPixels: numDiffPixels };
        } else if (numDiffPixels > effectiveMaxDiff) {
          fs.writeFileSync(screenshotPath, newBuffer);
          console.log(`[Updated: ${numDiffPixels} px diff] ${path.basename(screenshotPath)}`);
          result = { status: 'updated', diffPixels: numDiffPixels };
        } else {
          console.log(`[Unchanged: ${numDiffPixels} px diff] ${path.basename(screenshotPath)}`);
          result = { status: 'unchanged', diffPixels: numDiffPixels };
        }
      }
    } catch {
      fs.writeFileSync(screenshotPath, newBuffer);
      console.log(`[Updated: fallback] ${path.basename(screenshotPath)}`);
      result = { status: 'updated' };
    }
  }

  syncToLandingIfMapped(screenshotPath);
  return result;
}

const VIEWS = [
  { slug: 'dashboard', path: '/' },
  { slug: 'trips', path: '/trips' },
  { slug: 'lists', path: '/listen' },
  { slug: 'spots', path: '/excursions' },
  { slug: 'tour', path: '/excursions?group=tours#excursion-3' },
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
  test.beforeEach(async ({ page }) => {
    await page.request.put('/api/users/me/icon-settings', {
      data: {
        settings: {
          groups: { navigation: 'icons', categories: 'emoji', weather: 'icons' },
          variants: { navigation: 'outline', categories: 'outline', weather: 'outline' },
          navColored: true,
          colorizeWeather: true,
          colorizeCategories: true,
        },
      },
    });
  });

  for (const view of VIEWS) {
    test(`Capture screenshots for view: ${view.slug}`, async ({ page }) => {
      test.setTimeout(90000);

      // Set fixed clock to SCREENSHOT_REFERENCE_DATE (2026-08-07T10:00:00Z - 1 week before departure)
      await page.clock.setFixedTime(new Date(SCREENSHOT_REFERENCE_DATE));

      // 1. Intercept trip API calls to set start_date and end_date to static mid-August dates
      await page.route('**/api/trips*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();

        if (Array.isArray(json)) {
          for (const t of json) {
            if (t.id === 1) {
              t.start_date = SCREENSHOT_TRIP_DATES.start;
              t.end_date = SCREENSHOT_TRIP_DATES.end;
              t.image_url = '/demo/lissabon.jpg';
            }
          }
        } else if (json && typeof json === 'object') {
          if (json.id === 1) {
            json.start_date = SCREENSHOT_TRIP_DATES.start;
            json.end_date = SCREENSHOT_TRIP_DATES.end;
            json.image_url = '/demo/lissabon.jpg';
          }
        }
        await route.fulfill({ json });
      });

      // 2. Mock Open-Meteo weather forecast with 18 days of static realistic summer weather in Lisbon
      await page.route('**/api.open-meteo.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(SCREENSHOT_WEATHER),
        });
      });

      // 3. Intercept todos API calls to align due dates with static August timeline
      await page.route('**/api/todos*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            const match = SCREENSHOT_TODOS.find((t) => item.title.includes(t.title.slice(0, 15)));
            if (match) {
              item.due_date = match.due_date;
              item.done = match.done;
            }
          }
        }
        await route.fulfill({ json });
      });

      // 4. Intercept schedule API calls so items align with static August trip days
      await page.route('**/api/schedule*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            const match = SCREENSHOT_SCHEDULE.find((s) =>
              item.title.includes(s.title.slice(0, 15))
            );
            if (match) {
              item.date = match.date;
              item.time = match.time;
              item.end_time = match.end_time;
            }
          }
        }
        await route.fulfill({ json });
      });

      // 5. Intercept budget expenses & transfers to ensure static August dates
      await page.route('**/api/budget*', async (route) => {
        const url = route.request().url();
        const response = await route.fetch();
        const json = await response.json();
        if (url.includes('/transfers') && Array.isArray(json)) {
          for (const item of json) {
            const match = SCREENSHOT_BUDGET_TRANSFERS.find((t) =>
              item.note?.includes(t.note?.slice(0, 10) ?? '')
            );
            if (match) item.date = match.date;
          }
        } else if (Array.isArray(json)) {
          for (const item of json) {
            const match = SCREENSHOT_BUDGET_EXPENSES.find((e) =>
              item.title.includes(e.title.slice(0, 12))
            );
            if (match) item.date = match.date;
          }
        }
        await route.fulfill({ json });
      });

      // 6. Intercept diary API calls to align dates with static August timeline
      await page.route('**/api/diary*', async (route) => {
        const response = await route.fetch();
        const json = await response.json();
        if (Array.isArray(json)) {
          for (const item of json) {
            const match = SCREENSHOT_DIARY.find((d) =>
              item.title?.includes(d.title?.slice(0, 10) ?? '')
            );
            if (match) item.date = match.date;
          }
        }
        await route.fulfill({ json });
      });

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await forceFontDisplayBlock(page);

        // Pre-configure localStorage before navigation:
        // - Close calendar drawer on all desktop views except calendar (including dashboard)
        // - Open calendar drawer on calendar view on desktop, pulled to 1/3 screen width (640px)
        // - Set spots drawer width to half of viewport on desktop (960px for 1920px Full HD) for all spots/tour views
        await page.addInitScript(
          ({ slug, isDesktop }) => {
            if (slug === 'calendar' && isDesktop) {
              localStorage.setItem('reisotor-drawer-calendar-open', 'true');
              localStorage.setItem('reisotor-drawer-calendar-width', '640');
            } else {
              localStorage.setItem('reisotor-drawer-calendar-open', 'false');
            }
            if (isDesktop && (slug === 'spots' || slug === 'tour')) {
              localStorage.setItem('reisotor-spots-col-width', '960');
            } else if (!isDesktop) {
              localStorage.setItem('reisotor-spots-col-width', '380');
            }
          },
          { slug: view.slug, isDesktop: vp.name === 'desktop' }
        );

        const targetPath =
          view.slug === 'calendar' && vp.name === 'desktop' ? '/listen?tab=todo' : view.path;
        await page.goto(targetPath);
        await waitForAppReady(page);
        await waitForMapTiles(page);

        // Ensure Calendar drawer is closed on non-calendar desktop views if it was already open
        if (vp.name === 'desktop' && view.slug !== 'calendar') {
          const calendarTab = page.locator('.drawer-tab[aria-label*="Kalender"]');
          if (
            (await calendarTab.count()) > 0 &&
            (await calendarTab.getAttribute('aria-expanded')) === 'true'
          ) {
            await calendarTab.click();
            await page.waitForTimeout(300);
          }
        }

        // Ensure Calendar drawer is open on desktop calendar screenshot and wait for content
        if (vp.name === 'desktop' && view.slug === 'calendar') {
          const calendarTab = page.locator('.drawer-tab[aria-label*="Kalender"]');
          if (
            (await calendarTab.count()) > 0 &&
            (await calendarTab.getAttribute('aria-expanded')) !== 'true'
          ) {
            await calendarTab.click();
            await page.waitForTimeout(300);
          }
          await page.locator('.drawer-panel').waitFor({ state: 'visible', timeout: 15_000 });
          await page.locator('.todo-page').waitFor({ state: 'visible', timeout: 15_000 });
        }

        // Calendar view specific preparation: focus "Urlaub" instead of "Heute" (Requirement: Urlaub focused in August)
        if (view.slug === 'calendar') {
          const vacationBtn = page
            .locator('.jump-row button')
            .filter({ hasText: 'Urlaub' })
            .first();
          await vacationBtn.waitFor({ state: 'visible', timeout: 15_000 });
          await vacationBtn.click();
          await page
            .locator('.jump-row button.is-active')
            .filter({ hasText: 'Urlaub' })
            .first()
            .waitFor({ state: 'visible', timeout: 5_000 });
          await page.waitForTimeout(400);
        }

        // Spots / Tour view specific preparation: wait for spots drawer & map container to be visible
        if (view.slug === 'spots' || view.slug === 'tour') {
          await page.locator('.spots-col').waitFor({ state: 'visible', timeout: 15_000 });
          await page.locator('.leaflet-container').waitFor({ state: 'visible', timeout: 15_000 });
          await waitForMapTiles(page);
        }

        // Tour view specific preparation: trigger map focus on tour & wait for serpentine path & Leaflet settle
        if (view.slug === 'tour') {
          const tourCard = page.locator('.tour-group-card').filter({ hasText: 'Panoramatour' });
          const showOnMapBtn = tourCard.locator('.show-on-map-btn');
          if (await showOnMapBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await showOnMapBtn.click();
          }
          await page
            .locator('.tour-station-line path')
            .first()
            .waitFor({ state: 'visible', timeout: 5000 })
            .catch(() => {});
          await waitForMapTiles(page);
        }

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
          await waitForMapTiles(page);

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
    test.setTimeout(180000);
    await page.clock.setFixedTime(new Date(SCREENSHOT_REFERENCE_DATE));
    await forceFontDisplayBlock(page);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
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
