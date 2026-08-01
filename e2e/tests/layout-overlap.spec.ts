import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, expectNotCoveredBy, expectWithinBox, expectWithinViewport } from './helpers/layout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'),
);
const dinner = seeded.scheduleItems.find((i: { title: string }) => i.title === 'Abendessen im Time Out Market');
const excursion = seeded.ideas.find((i: { title: string }) => i.title === 'Sightseeing-Tag Belém');

// Regressionsnetz gegen Elemente, die über ihre vorgesehene Box hinausragen oder von Laschen/
// Schubladen/Dialogen verdeckt werden (siehe CLAUDE.md, "Wann einen neuen/aktualisierten Test
// schreiben?" — hier: Positionierungs-/Layout-Bugs, ein bewusst als wert erachteter Fall). Ergänzt
// den bereits bestehenden, engeren "MapsAppPicker dropdown is not clipped by the modal"-Test in
// calendar.spec.ts (Dropdown vs. Modal-Overflow) um weitere, bereits real aufgetretene
// Überdeckungs-/Überlauf-Muster (Drawer-Overflow, mobile Bottom-Sheet vs. NavBar, schwebende Buttons
// vs. Status-Chips) über die wichtigsten Viewports hinweg.

test.describe('Kalender-Drawer: Kalender-Export-Dropdown wird nicht vom Drawer-Panel abgeschnitten', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('dropdown bleibt innerhalb des Viewports sichtbar, auch nahe am unteren Rand der Schublade', async ({ page }) => {
    // Regressionstest für einen realen Bug: das Dropdown hing per position:absolute an seinem
    // Trigger-Button innerhalb der scrollbaren Kalender-Schublade — bei einem Termin nahe am
    // unteren Rand der (auf Desktop höhenbegrenzten) Schublade ragte es dadurch unsichtbar über den
    // Viewport-Rand hinaus. Fix in ScheduleView.vue: per Teleport + position:fixed positioniert,
    // mit nachträglicher Klemmung an den unteren Viewport-Rand — dasselbe etablierte Muster wie
    // MapsAppPicker.vue's Dropdown-vs-Modal-Fix (siehe calendar.spec.ts).
    await page.goto('/');
    await page.locator(`.day[data-date="${dinner.date}"]`).click();
    const item = page.locator('.day-detail .items .item', { hasText: dinner.title });
    await item.locator('button[aria-label="Zum eigenen Kalender hinzufügen"]').click();

    const menu = page.locator('.picker-menu');
    await expect(menu).toBeVisible();
    await expectWithinViewport(page, menu);
  });
});

test.describe('Mobile: Kollabiertes Bottom-Sheet verdeckt keine Karten-Steuerelemente', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Karten-Button "Alle eingetragenen Orte anzeigen" bleibt über dem kollabierten Sheet sichtbar', async ({ page }) => {
    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Spots-Liste weiter runterschieben' }).click();

    const fitBtn = page.getByRole('button', { name: 'Alle eingetragenen Orte anzeigen' });
    const sheet = page.locator('.spots-col');
    await expect(sheet).toHaveClass(/collapsed/);
    await expectNotCoveredBy(page, fitBtn, sheet);
  });
});

test.describe('Mobile: nach unten positionierte NavBar überdeckt nicht die Sheet-Bedienelemente', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Hoch-/Runterschieben-Buttons des Spots-Sheets bleiben über der NavBar bedienbar', async ({ page }) => {
    // Regressionstest für einen realen Bug: .page's Höhenformel in ExcursionsView.vue zog bisher
    // nur --navbar-offset ab, nie --navbar-bottom-offset — bei navPosition.mobile === 'bottom' blieb
    // .spots-col (position:absolute; bottom:0) dadurch bis zum tatsächlichen Viewport-Rand
    // gestreckt und geriet hinter die fixierte NavBar (z-index 10 vs. spots-col z-index 5). Siehe
    // Fix in ExcursionsView.vue's .page-Regel.
    await page.addInitScript(() => localStorage.setItem('reisotor-nav-position-mobile', 'bottom'));
    await page.goto('/excursions');

    const navbar = page.locator('nav.navbar.mobile-bottom');
    await expect(navbar).toBeVisible();

    const upBtn = page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' });
    const downBtn = page.getByRole('button', { name: 'Spots-Liste weiter runterschieben' });
    await expectNotCoveredBy(page, upBtn, navbar);
    await expectNotCoveredBy(page, downBtn, navbar);
  });
});

test.describe('TripSwitcher-Dropdown liegt über Header/NavBar, nicht darunter', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(name, () => {
      test.use({ viewport });

      test('dropdown bleibt im Viewport und ist nicht von der NavBar verdeckt', async ({ page }) => {
        await page.goto('/');
        await page.locator('.switcher-btn').click();
        const dropdown = page.locator('.trip-switcher .dropdown');
        await expect(dropdown).toBeVisible();
        await expectWithinViewport(page, dropdown);
        await expectNotCoveredBy(page, dropdown, page.locator('nav.navbar'));
      });
    });
  }
});

test.describe('Dashboard: Aktions-Button bleibt innerhalb seiner Card', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test.describe(name, () => {
      test.use({ viewport });

      test('"Bearbeiten"-Button der Urlaub-Hero-Card ragt nicht heraus', async ({ page }) => {
        await page.goto('/');
        const heroCard = page.locator('.hero.card');
        const editBtn = heroCard.locator('.banner-edit-btn');
        await expect(editBtn).toBeVisible();
        await expectWithinBox(editBtn, heroCard);
      });
    });
  }
});

test.describe('Mobile: ExcursionCard-Löschen-Button überdeckt nicht den Status-Chip', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('Status-Chip einer geplanten Tour bleibt neben dem Löschen-Button erreichbar', async ({ page }) => {
    // Regressionstest für einen vom Nutzer gemeldeten Bug: im mobilen Spaltenlayout
    // (@media max-width:480px) landeten .card-delete (oben rechts relativ zur ganzen Card) und
    // .status (oben rechts relativ zu .image, das dort die volle Kartenbreite einnimmt) in
    // derselben Ecke. Siehe Fix in ExcursionCard.vue.
    await page.goto('/tours');
    const card = page.locator('.excursion-card', { hasText: excursion.title });
    await expect(card).toBeVisible();
    const statusChip = card.locator('.status');
    const deleteBtn = card.locator('.card-delete');
    await expect(statusChip).toBeVisible();
    await expect(deleteBtn).toBeVisible();
    await expectNotCoveredBy(page, statusChip, deleteBtn);
  });
});

// Referenz: das Dropdown-vs-Modal-Overflow-Muster (MapsAppPicker im Termin-Detail-Dialog) ist
// bereits in calendar.spec.ts abgedeckt ("MapsAppPicker dropdown is not clipped by the modal") —
// hier bewusst nicht dupliziert.
