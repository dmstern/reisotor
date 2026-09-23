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
  SCREENSHOT_NOTES,
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
  'packing-desktop-light.png': 'screenshot-packing-light.png',
  'packing-desktop-dark.png': 'screenshot-packing-dark.png',
  'packing-mobile-light.png': 'screenshot-packing-mobile-light.png',
  'packing-mobile-dark.png': 'screenshot-packing-mobile-dark.png',
  'diary-desktop-light.png': 'screenshot-diary-light.png',
  'diary-desktop-dark.png': 'screenshot-diary-dark.png',
  'diary-mobile-light.png': 'screenshot-diary-mobile-light.png',
  'diary-mobile-dark.png': 'screenshot-diary-mobile-dark.png',
  'spots-desktop-light.png': 'screenshot-spots-light.png',
  'spots-desktop-dark.png': 'screenshot-spots-dark.png',
};

const ALIAS_COPY_MAP: Record<string, string> = {
  'packing-desktop-light.png': 'lists-desktop-light.png',
  'packing-desktop-dark.png': 'lists-desktop-dark.png',
  'packing-mobile-light.png': 'lists-mobile-light.png',
  'packing-mobile-dark.png': 'lists-mobile-dark.png',
  'settings-account-desktop-light.png': 'settings-desktop-light.png',
  'settings-account-desktop-dark.png': 'settings-desktop-dark.png',
  'settings-account-mobile-light.png': 'settings-mobile-light.png',
  'settings-account-mobile-dark.png': 'settings-mobile-dark.png',
};

function checkAndCopyAlias(screenshotPath: string) {
  const baseName = path.basename(screenshotPath);
  const aliasName = ALIAS_COPY_MAP[baseName];
  if (aliasName) {
    const aliasPath = path.join(path.dirname(screenshotPath), aliasName);
    fs.copyFileSync(screenshotPath, aliasPath);
    console.log(`[Copied alias] ${baseName} -> ${aliasName}`);
  }
}

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
  checkAndCopyAlias(screenshotPath);
  return result;
}

async function setupScreenshotMocks(page: Page) {
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
        const match = SCREENSHOT_SCHEDULE.find((s) => item.title.includes(s.title.slice(0, 15)));
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
    const url = route.request().url();
    const response = await route.fetch();
    const json = await response.json();
    if (url.includes('/comments') && Array.isArray(json)) {
      for (const item of json) {
        item.created_at = '2026-08-14T21:15:00.000Z';
      }
    } else if (Array.isArray(json)) {
      for (const item of json) {
        const match = SCREENSHOT_DIARY.find((d) =>
          item.title?.includes(d.title?.slice(0, 10) ?? '')
        );
        if (match) {
          item.date = match.date;
          item.created_at = match.created_at;
        }
      }
    }
    await route.fulfill({ json });
  });

  // 7. Intercept notes API calls to set static August creation date
  await page.route('**/api/notes*', async (route) => {
    const url = route.request().url();
    const response = await route.fetch();
    const json = await response.json();
    if (url.includes('/comments') && Array.isArray(json)) {
      for (const item of json) {
        item.created_at = '2026-08-05T12:00:00.000Z';
      }
    } else if (Array.isArray(json)) {
      for (const item of json) {
        const match = SCREENSHOT_NOTES.find((n) =>
          item.title?.includes(n.title?.slice(0, 10) ?? '')
        );
        if (match) {
          item.created_at = match.created_at;
          item.updated_at = match.updated_at;
        } else {
          item.created_at = '2026-08-05T11:35:00.000Z';
        }
      }
    }
    await route.fulfill({ json });
  });

  // 8. Intercept spots API calls so accommodation dates and comments align with August timeline
  await page.route('**/api/spots*', async (route) => {
    const url = route.request().url();
    const response = await route.fetch();
    const json = await response.json();
    if (url.includes('/comments') && Array.isArray(json)) {
      for (const item of json) {
        item.created_at = '2026-08-06T14:15:00.000Z';
      }
    } else if (Array.isArray(json)) {
      for (const item of json) {
        if (item.category === 'Unterkunft' || item.start_date) {
          item.start_date = SCREENSHOT_TRIP_DATES.start;
          item.end_date = SCREENSHOT_TRIP_DATES.end;
        }
      }
    }
    await route.fulfill({ json });
  });

  // 9. Intercept ideas/excursions comments to set static August dates
  await page.route('**/api/ideas*', async (route) => {
    const url = route.request().url();
    const response = await route.fetch();
    const json = await response.json();
    if (url.includes('/comments') && Array.isArray(json)) {
      for (const item of json) {
        item.created_at = '2026-08-06T16:00:00.000Z';
      }
    }
    await route.fulfill({ json });
  });

  // 10. Intercept tracks to ensure static August dates
  await page.route('**/api/**/tracks*', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (Array.isArray(json)) {
      for (const item of json) {
        item.started_at = '2026-08-15T18:30:00.000Z';
        item.ended_at = '2026-08-15T19:45:00.000Z';
      }
    }
    await route.fulfill({ json });
  });
}

async function applyScreenshotStyles(page: Page) {
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
}

const VIEWS = [
  { slug: 'dashboard', path: '/' },
  { slug: 'trips', path: '/trips' },
  { slug: 'packing', path: '/listen?tab=packing' },
  { slug: 'todo', path: '/listen?tab=todo' },
  { slug: 'shopping', path: '/listen?tab=shopping' },
  { slug: 'spots', path: '/excursions?group=category' },
  { slug: 'tour', path: '/excursions?group=tours#excursion-3' },
  { slug: 'tracks', path: '/excursions?group=tracks' },
  { slug: 'calendar', path: '/calendar' },
  { slug: 'budget', path: '/budget' },
  { slug: 'notes', path: '/notes' },
  { slug: 'diary', path: '/diary' },
  { slug: 'settings-account', path: '/settings?tab=account' },
  { slug: 'settings-users', path: '/settings?tab=users' },
  { slug: 'settings-app', path: '/settings?tab=app' },
  { slug: 'settings-trip', path: '/settings?tab=trip' },
  { slug: 'settings-notifications', path: '/settings?tab=notifications' },
  { slug: 'settings-data', path: '/settings?tab=data' },
  { slug: 'settings-about', path: '/settings?tab=about' },
];

interface DialogSpec {
  slug: string;
  path: string;
  open: (page: Page) => Promise<void>;
  waitSelector: string;
}

const DIALOGS: DialogSpec[] = [
  {
    slug: 'dialog-trip',
    path: '/trips',
    open: async (page) => {
      const btn = page.locator('.trip-card').first().locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Urlaub bearbeiten"), .trip-form',
  },
  {
    slug: 'dialog-trip-members',
    path: '/trips',
    open: async (page) => {
      const btn = page.locator('.trip-card').first().locator('[aria-label="Mitglieder verwalten"]');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Mitglieder"), .trip-members-dialog',
  },
  {
    slug: 'dialog-create-user',
    path: '/settings?tab=users',
    open: async (page) => {
      const btn = page.locator('button:has-text("Nutzer anlegen")');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Neuen Nutzer anlegen"), .create-user-dialog',
  },
  {
    slug: 'dialog-feedback',
    path: '/settings?tab=about',
    open: async (page) => {
      const btn = page.locator('button:has-text("Feedback geben")');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Feedback & Bug melden"), .feedback-dialog',
  },
  {
    slug: 'dialog-spot',
    path: '/excursions?group=category',
    open: async (page) => {
      const card = page.locator('.spot-card').first();
      await card.waitFor({ state: 'visible', timeout: 15000 });
      await card.scrollIntoViewIfNeeded();
      await card.click();
      const btn = card.locator('.overlay-edit-btn');
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.click();
    },
    waitSelector: '.modal:has-text("Spot bearbeiten")',
  },
  {
    slug: 'dialog-tour',
    path: '/excursions?group=tours#excursion-3',
    open: async (page) => {
      const card = page.locator('.tour-group-card').first();
      await card.waitFor({ state: 'visible', timeout: 15000 });
      await card.scrollIntoViewIfNeeded();
      const editBtn = card.locator('.tour-edit-btn');
      if (!(await editBtn.isVisible().catch(() => false))) {
        await card.click();
      }
      await editBtn.waitFor({ state: 'visible', timeout: 5000 });
      await editBtn.click();
    },
    waitSelector: '.modal:has-text("Tour bearbeiten")',
  },
  {
    slug: 'dialog-track',
    path: '/excursions?group=tracks',
    open: async (page) => {
      const btn = page.locator('[aria-label="Aufzeichnung bearbeiten"]').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Aufzeichnung bearbeiten")',
  },
  {
    slug: 'dialog-todo',
    path: '/listen?tab=todo',
    open: async (page) => {
      const item = page.locator('.checkable-list-item').first();
      await item.waitFor({ state: 'visible', timeout: 15000 });
      const btn = item.locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Aufgabe bearbeiten")',
  },
  {
    slug: 'dialog-packing',
    path: '/listen?tab=packing',
    open: async (page) => {
      const item = page.locator('.checkable-list-item').first();
      await item.waitFor({ state: 'visible', timeout: 15000 });
      const btn = item.locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Gegenstand bearbeiten")',
  },
  {
    slug: 'dialog-shopping',
    path: '/listen?tab=shopping',
    open: async (page) => {
      const item = page.locator('.checkable-list-item').first();
      await item.waitFor({ state: 'visible', timeout: 15000 });
      const btn = item.locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Artikel bearbeiten")',
  },
  {
    slug: 'dialog-budget-pot',
    path: '/budget',
    open: async (page) => {
      const btn = page.locator('button:has-text("Budget anlegen")').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Budget anlegen")',
  },
  {
    slug: 'dialog-budget-expense',
    path: '/budget',
    open: async (page) => {
      const btn = page.locator('button:has-text("Ausgabe eintragen")').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Ausgabe eintragen")',
  },
  {
    slug: 'dialog-budget-transfer',
    path: '/budget',
    open: async (page) => {
      const btn = page.locator('button:has-text("Überweisung eintragen")').first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Überweisung eintragen")',
  },
  {
    slug: 'dialog-schedule',
    path: '/calendar',
    open: async (page) => {
      const btn = page
        .locator(
          '.calendar-drawer-content button:has-text("Neu"), .calendar-controls button:has-text("Neu"), button:has-text("Neu")'
        )
        .first();
      await btn.waitFor({ state: 'visible', timeout: 15000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Termin anlegen")',
  },
  {
    slug: 'dialog-note',
    path: '/notes',
    open: async (page) => {
      const card = page.locator('.note-card').first();
      await card.waitFor({ state: 'visible', timeout: 15000 });
      const btn = card.locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Notiz bearbeiten")',
  },
  {
    slug: 'dialog-diary',
    path: '/diary',
    open: async (page) => {
      const entry = page.locator('.entries .entry').first();
      await entry.waitFor({ state: 'visible', timeout: 15000 });
      const btn = entry.locator('.edit-btn');
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
    },
    waitSelector: '.modal:has-text("Eintrag bearbeiten")',
  },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 390, height: 844 },
];

const THEMES = ['light', 'dark'] as const;

test.use({
  timezoneId: 'UTC',
  locale: 'de-DE',
});

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

  test('Capture screenshots for view: login', async ({ browser }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
      storageState: undefined,
      locale: 'de-DE',
      timezoneId: 'UTC',
    });
    const page = await context.newPage();
    await setupScreenshotMocks(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await forceFontDisplayBlock(page);
      await page.goto('/login');
      await page.locator('.login-page').waitFor({ state: 'visible', timeout: 15000 });
      await applyScreenshotStyles(page);

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
          `login-${vp.name}-${theme}.png`
        );

        await saveScreenshotIfChanged(page, screenshotPath, { fullPage: false });
      }
    }
    await context.close();
  });

  for (const view of VIEWS) {
    test(`Capture screenshots for view: ${view.slug}`, async ({ page }) => {
      test.setTimeout(90000);
      await setupScreenshotMocks(page);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await forceFontDisplayBlock(page);

        // Pre-configure localStorage before navigation:
        // - Close calendar drawer on all desktop views except calendar (including dashboard)
        // - Open calendar drawer on calendar view on desktop, pulled to 1/3 screen width (640px)
        // - Set spots drawer width to half of viewport on desktop (960px for 1920px Full HD) for all spots/tour/tracks views
        await page.addInitScript(
          ({ slug, isDesktop }) => {
            if (slug === 'calendar' && isDesktop) {
              localStorage.setItem('reisotor-drawer-calendar-open', 'true');
              localStorage.setItem('reisotor-drawer-calendar-width', '640');
            } else {
              localStorage.setItem('reisotor-drawer-calendar-open', 'false');
            }
            if (isDesktop && (slug === 'spots' || slug === 'tour' || slug === 'tracks')) {
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

        // Spots / Tour / Tracks view specific preparation: wait for spots drawer & map container to be visible
        if (view.slug === 'spots' || view.slug === 'tour' || view.slug === 'tracks') {
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

        await applyScreenshotStyles(page);

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

  for (const dlg of DIALOGS) {
    test(`Capture screenshots for dialog: ${dlg.slug}`, async ({ page }) => {
      test.setTimeout(90000);
      await setupScreenshotMocks(page);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await forceFontDisplayBlock(page);

        await page.addInitScript(
          ({ isDesktop, isScheduleDlg }) => {
            if (isScheduleDlg && isDesktop) {
              localStorage.setItem('reisotor-drawer-calendar-open', 'true');
              localStorage.setItem('reisotor-drawer-calendar-width', '640');
            } else {
              localStorage.setItem('reisotor-drawer-calendar-open', 'false');
            }
            if (isDesktop) {
              localStorage.setItem('reisotor-spots-col-width', '960');
            } else {
              localStorage.setItem('reisotor-spots-col-width', '380');
              localStorage.setItem('reisotor-spots-sheet-state', 'half');
            }
          },
          { isDesktop: vp.name === 'desktop', isScheduleDlg: dlg.slug === 'dialog-schedule' }
        );

        const targetPath =
          dlg.slug === 'dialog-schedule' && vp.name === 'desktop' ? '/listen?tab=todo' : dlg.path;
        await page.goto(targetPath);
        await waitForAppReady(page);
        await waitForMapTiles(page);

        // Ensure Calendar drawer state on desktop
        if (vp.name === 'desktop') {
          const calendarTab = page.locator('.drawer-tab[aria-label*="Kalender"]');
          if (dlg.slug === 'dialog-schedule') {
            if (
              (await calendarTab.count()) > 0 &&
              (await calendarTab.getAttribute('aria-expanded')) !== 'true'
            ) {
              await calendarTab.click();
              await page.waitForTimeout(300);
            }
          } else {
            if (
              (await calendarTab.count()) > 0 &&
              (await calendarTab.getAttribute('aria-expanded')) === 'true'
            ) {
              await calendarTab.click();
              await page.waitForTimeout(300);
            }
          }
        }

        await applyScreenshotStyles(page);

        // Open the dialog
        await dlg.open(page);
        await page.locator(dlg.waitSelector).first().waitFor({ state: 'visible', timeout: 15_000 });
        await page.waitForTimeout(400);

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
            `${dlg.slug}-${vp.name}-${theme}.png`
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

      await applyScreenshotStyles(page);

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
