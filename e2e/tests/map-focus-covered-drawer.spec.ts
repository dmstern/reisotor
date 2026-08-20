import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, expectNotCoveredBy, expectNoOverlap } from './helpers/layout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));
const excursion = seeded.ideas.find((i: { title: string }) => i.title === 'Sightseeing-Tag Belém');

// Wählt excursion.date im Kalender aus und klickt "🗺️ Tag auf Karte anzeigen" (ScheduleView.vue's
// showDayOnMap(), löst denselben drawers.focusMapOnDate()-Pfad wie TripMap.vue's eigener
// Tage-Streifen aus) - auf Mobil ist der Kalender eine eigene Route, auf Desktop-Breite eine neben
// der Karte zu öffnende Schublade (siehe CLAUDE.md, "Responsive Besonderheit").
async function focusDayViaCalendar(page: Page, viewportName: string) {
  if (viewportName === 'mobile') {
    await page.goto('/calendar');
  } else {
    await page.goto('/excursions');
    const tab = page.locator('.drawer-tab[aria-label*="Kalender"]');
    if ((await tab.getAttribute('aria-expanded')) === 'false') await tab.click();
  }
  // "🏖️ Urlaub" springt zum Start des Urlaubszeitraums - stellt sicher, dass excursion.date (irgendwo
  // im Urlaubszeitraum) in der sichtbaren Wochenauswahl liegt, unabhängig vom heutigen Datum.
  // exact: true - sonst matcht das nicht-exakte Substring-Matching auch AppHeader.vue's
  // TripSwitcher-Knopf (Trip-Name "Sommerurlaub Lissabon" enthält "Urlaub" als Substring).
  await page.getByRole('button', { name: 'Urlaub', exact: true }).click();
  await page.locator(`.day[data-date="${excursion.date}"]`).click();
  await page.getByRole('button', { name: 'Tag auf Karte anzeigen' }).click();
  await page.waitForURL('**/excursions');
}

// Regressionstest für einen bereits mehrfach aufgetretenen UX-Bug (TripMap.vue's centerOnPoint()/
// fitBoundsWithCoveredBottom()): die Spots-Schublade (.spots-col) rendert als Bottom-Sheet ÜBER dem
// unteren Teil der Karte, sobald ExcursionsView.vue's CSS-Container-Query (@container app-main
// (min-width: 900px)) nicht greift - das ist NICHT dasselbe wie "Fenster ist schmal genug für
// Mobile" (useIsDesktop.ts's window.matchMedia(min-width:800px)): bei mittleren Fensterbreiten
// (>800px, aber .app-main <900px, z. B. bei geöffneter Kalender-Schublade) rendert das Sheet
// weiterhin als Overlay, obwohl useIsDesktop bereits "Desktop" meldet. Ein fokussierter Punkt/
// Ausschnitt darf deshalb nicht im Zentrum des GESAMTEN Karten-Containers landen, sondern muss im
// Zentrum der tatsächlich sichtbaren (nicht überlagerten) Fläche erscheinen - siehe
// ExcursionsView.vue's mapCoveredBottomPx/isSheetOverlayMode (ResizeObserver auf .app-main statt
// window.matchMedia) für den Fix. Deckt beide Layout-Modi ab, in denen das Sheet überlagern kann
// (VIEWPORTS.mobile, VIEWPORTS.narrowDesktop - Letzteres reproduziert exakt die Schwellen-
// Diskrepanz, s. o.), sowie alle vier Fokus-Arten (Einzel-Spot, "Alle anzeigen", Ausflug/Tour,
// Tag).
for (const [viewportName, viewport] of Object.entries({ mobile: VIEWPORTS.mobile, narrowDesktop: VIEWPORTS.narrowDesktop })) {
  test.describe(`Karten-Fokus berücksichtigt die Spots-Schublade (${viewportName})`, () => {
    test.use({ viewport });

    test('fokussierter Einzelpunkt (Spot-Klick) bleibt oberhalb der Schubladen-Kante sichtbar', async ({ page }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Titel statt der ganzen Karte anklicken - ein Klick auf die Karten-Mitte kann auf einem der
      // @click.stop-Anfasser (Einplanen/Auf Tour ziehen) weiter unten landen, ohne den Fokus/die
      // Zentrierung überhaupt auszulösen.
      await page.locator('.spot-card').first().locator('h3').click();
      await page.waitForTimeout(400);

      const marker = page.locator('.leaflet-marker-icon').first();
      await expect(marker).toBeVisible();
      await expectNotCoveredBy(page, marker, sheet);
    });

    test('"Alle anzeigen" (mehrere Punkte) bleibt komplett oberhalb der Schubladen-Kante', async ({ page }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      await page.locator('.fit-btn').first().click(); // 🔍 "Alle eingetragenen Orte anzeigen"
      await page.waitForTimeout(400);

      const markers = page.locator('.leaflet-marker-icon');
      const count = await markers.count();
      expect(count).toBeGreaterThan(1); // sonst testet dieser Fall nicht wirklich den fitBounds()-Pfad
      for (let i = 0; i < count; i++) {
        await expectNoOverlap(markers.nth(i), sheet);
      }
    });

    test('fokussierte Tour (Ausflug/Route) bleibt komplett oberhalb der Schubladen-Kante', async ({ page }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Sortieren/Filtern stecken auf echten mobilen Breiten standardmäßig hinter "⚙️ Anzeige &
      // Filter" (siehe ExcursionsView.vue) - bei narrowDesktop bleibt der Umschalter per @media
      // (nicht @container) unsichtbar, dort ist die Zeile schon offen. Der Spots-/Touren-Umschalter
      // selbst sitzt seit #155 direkt neben der Überschrift, ist davon unabhängig immer erreichbar.
      const filterToggle = page.locator('.filter-toggle-row');
      if (await filterToggle.isVisible()) await filterToggle.click();
      await page.locator('.header h2').getByRole('button', { name: 'Touren' }).click();
      const card = page.locator('.excursion-card', { hasText: excursion.title });
      await expect(card).toBeVisible();
      await card.getByRole('button', { name: 'Auf Karte anzeigen' }).click();
      await page.waitForTimeout(400);

      // Nur geometrischer Überlapp mit der Schublade (nicht expectNotCoveredBy) - die immer
      // sichtbare .fit-btn-Knopfleiste (Zoom/Standort/…) ist bewusst dauerhaft über der Karte
      // verankert und kein Teil des hier getesteten Schubladen-Deckungs-Bugs.
      const markers = page.locator('.leaflet-marker-icon');
      const count = await markers.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expectNoOverlap(markers.nth(i), sheet);
      }
    });

    test('fokussierter Tag bleibt komplett oberhalb der Schubladen-Kante', async ({ page }) => {
      await focusDayViaCalendar(page, viewportName);
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();
      await page.waitForTimeout(400);

      const markers = page.locator('.leaflet-marker-icon');
      const count = await markers.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expectNoOverlap(markers.nth(i), sheet);
      }
    });
  });
}
