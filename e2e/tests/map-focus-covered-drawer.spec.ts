import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, expectNotCoveredBy, expectNoOverlap } from './helpers/layout';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8')
);
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
// fitBoundsWithCoveredBottom()): auf Mobilgeräten (< 1024px) rendert die Spots-Schublade (.spots-col)
// als Bottom-Sheet ÜBER dem unteren Teil der Karte. Auf Desktop-Breiten (≥ 1024px) schwebt sie dagegen
// permanent als Seitenspalte links. Ein fokussierter Punkt/Ausschnitt auf Mobilgeräten darf deshalb
// nicht im Zentrum des GESAMTEN Karten-Containers landen, sondern muss im Zentrum der tatsächlich
// sichtbaren (nicht überlagerten) Fläche erscheinen - siehe ExcursionsView.vue's mapCoveredBottomPx
// und TripMap.vue's centerOnPoint/fitBoundsWithCoveredBottom für den Fix.
for (const [viewportName, viewport] of Object.entries({
  mobile: VIEWPORTS.mobile,
})) {
  test.describe(`Karten-Fokus berücksichtigt die Spots-Schublade (${viewportName})`, () => {
    test.use({ viewport });

    test('fokussierter Einzelpunkt (Spot-Klick) bleibt oberhalb der Schubladen-Kante sichtbar', async ({
      page,
    }) => {
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

    test('"Alle anzeigen" (mehrere Punkte) bleibt komplett oberhalb der Schubladen-Kante', async ({
      page,
    }) => {
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

    test('fokussierte Tour (Ausflug/Route) bleibt komplett oberhalb der Schubladen-Kante', async ({
      page,
    }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Sortieren/Filtern stecken auf mobilen Breiten standardmäßig hinter "⚙️ Anzeige &
      // Filter" (siehe ExcursionsView.vue). Der Spots-/Touren-Umschalter
      // selbst sitzt seit #155 direkt neben der Überschrift, ist davon unabhängig immer erreichbar.
      const filterToggle = page.locator('.filter-toggle-row');
      if (await filterToggle.isVisible()) await filterToggle.click();
      await page.locator('.header h2').getByRole('button', { name: 'Touren' }).click();
      const card = page.locator('.excursion-card', { hasText: excursion.title });
      await expect(card).toBeVisible();
      await card.locator('h3').click();
      await expect(card).toHaveClass(/expanded/);
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

    test('beim Maximieren der Schublade ("voll") bleibt der Kartenausschnitt unverändert', async ({
      page,
    }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();
      await expect(sheet).not.toHaveClass(/full/);
      await expect(sheet).not.toHaveClass(/collapsed/);

      const marker = page.locator('.leaflet-marker-icon').first();
      await expect(marker).toBeVisible();
      await page.waitForTimeout(400);

      const initialBox = await marker.boundingBox();
      expect(initialBox).not.toBeNull();

      // Schublade auf "voll" vergrößern
      await page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' }).click();
      await expect(sheet).toHaveClass(/full/);
      await page.waitForTimeout(400);

      // Nach dem Wechsel auf 'full' darf sich der Kartenausschnitt nicht geändert haben
      const fullBox = await marker.boundingBox();
      expect(fullBox).not.toBeNull();
      expect(fullBox!.y).toBeCloseTo(initialBox!.y, 0);
      expect(fullBox!.x).toBeCloseTo(initialBox!.x, 0);
    });

    test('beim Klick auf "Auf Karte anzeigen" bei einer Tour wird die Tour-Kachel im geschrumpften Drawer ans obere Ende gescrollt', async ({
      page,
    }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Touren-Ansicht wählen
      const filterToggle = page.locator('.filter-toggle-row');
      if (await filterToggle.isVisible()) await filterToggle.click();
      await page.locator('.header h2').getByRole('button', { name: 'Touren' }).click();
      await page.waitForTimeout(300);

      // Schublade auf "voll" vergrößern
      await page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' }).click();
      await expect(sheet).toHaveClass(/full/);
      await page.waitForTimeout(400);

      const cards = page.locator('.excursion-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Eine spätere Tour auswählen (nicht die allererste)
      const targetCard = cards.nth(Math.min(2, count - 1));
      await targetCard.scrollIntoViewIfNeeded();
      await targetCard.locator('h3').click();
      await expect(targetCard).toHaveClass(/expanded/);

      const showBtn = targetCard.getByRole('button', { name: 'Auf Karte anzeigen' });
      await expect(showBtn).toBeVisible();

      // "Auf Karte anzeigen" anklicken
      await showBtn.click();

      // Schublade schrumpft auf "partial" und Kachel wird sichtbar ans obere Ende gescrollt
      await expect(sheet).toHaveClass(/partial/);
      await page.waitForTimeout(600);

      const sheetBox = await sheet.boundingBox();
      const cardBox = await targetCard.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y).toBeGreaterThanOrEqual(sheetBox!.y);
      expect(cardBox!.y).toBeLessThan(sheetBox!.y + sheetBox!.height);
    });

    test('beim Klick auf "Auf Karte anzeigen" bei einem Spot wird die Spot-Kachel im geschrumpften Drawer ans obere Ende gescrollt', async ({
      page,
    }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Schublade auf "voll" vergrößern
      await page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' }).click();
      await expect(sheet).toHaveClass(/full/);
      await page.waitForTimeout(400);

      const cards = page.locator('.spot-card');
      const count = await cards.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Einen späteren Spot auswählen
      const targetCard = cards.nth(Math.min(3, count - 1));
      await targetCard.scrollIntoViewIfNeeded();
      await targetCard.locator('h3').click();
      await expect(targetCard).toHaveClass(/expanded/);

      const showBtn = targetCard.getByRole('button', { name: 'Auf Karte anzeigen' });
      await expect(showBtn).toBeVisible();

      // "Auf Karte anzeigen" anklicken
      await showBtn.click();

      // Schublade schrumpft auf "partial" und Kachel wird sichtbar ans obere Ende gescrollt
      await expect(sheet).toHaveClass(/partial/);
      await page.waitForTimeout(600);

      const sheetBox = await sheet.boundingBox();
      const cardBox = await targetCard.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.y).toBeGreaterThanOrEqual(sheetBox!.y);
      expect(cardBox!.y).toBeLessThan(sheetBox!.y + sheetBox!.height);
    });

    test('erneuter Klick auf "Auf Karte anzeigen" zentriert Tour nach Kartenbewegung erneut und Umschalten auf andere Tour funktioniert direkt', async ({
      page,
    }) => {
      await page.goto('/excursions');
      const sheet = page.locator('.spots-col');
      await expect(sheet).toBeVisible();

      // Touren-Ansicht wählen
      const filterToggle = page.locator('.filter-toggle-row');
      if (await filterToggle.isVisible()) await filterToggle.click();
      await page.locator('.header h2').getByRole('button', { name: 'Touren' }).click();

      // Erste Tour fokussieren
      const tour1 = page.locator('.excursion-card', { hasText: 'Sightseeing-Tag Belém' });
      await expect(tour1).toBeVisible();
      await tour1.locator('h3').click();
      await expect(tour1).toHaveClass(/expanded/);

      const showBtn1 = tour1.getByRole('button', { name: 'Auf Karte anzeigen' });
      await showBtn1.click();
      await expect(sheet).toHaveClass(/partial/);
      await page.waitForTimeout(400);

      const marker = page.locator('.leaflet-marker-icon').first();
      await expect(marker).toBeVisible();
      const initialBox = await marker.boundingBox();
      expect(initialBox).not.toBeNull();

      // Karte manuell verschieben
      const mapWrap = page.locator('.map-wrap');
      await mapWrap.dragTo(mapWrap, {
        sourcePosition: { x: 200, y: 100 },
        targetPosition: { x: 200, y: 250 },
      });
      await page.waitForTimeout(400);

      const movedBox = await marker.boundingBox();
      expect(movedBox).not.toBeNull();
      expect(Math.abs(movedBox!.y - initialBox!.y)).toBeGreaterThan(40);

      // Schublade wieder maximieren
      const stepUpBtn = page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' });
      await stepUpBtn.click();
      await expect(sheet).toHaveClass(/full/);

      // Erneut dieselbe Tour auf der Karte fokussieren -> muss wieder re-zentriert werden
      await showBtn1.click();
      await expect(sheet).toHaveClass(/partial/);
      await page.waitForTimeout(400);

      const recenteredBox = await marker.boundingBox();
      expect(recenteredBox).not.toBeNull();
      expect(recenteredBox!.y).toBeCloseTo(initialBox!.y, 0);
      expect(recenteredBox!.x).toBeCloseTo(initialBox!.x, 0);

      // Schublade erneut vergrößern und direkt andere Tour fokussieren (ohne vorherigen Fokus zu entfernen)
      await stepUpBtn.click();
      await expect(sheet).toHaveClass(/full/);

      const tour2 = page.locator('.excursion-card', { hasText: 'Panoramatour Alfama & Belém' });
      await expect(tour2).toBeVisible();
      await tour2.locator('h3').click();
      await expect(tour2).toHaveClass(/expanded/);

      const showBtn2 = tour2.getByRole('button', { name: 'Auf Karte anzeigen' });
      await expect(showBtn2).toBeVisible();
      await showBtn2.click();

      await expect(sheet).toHaveClass(/partial/);
      await page.waitForTimeout(400);

      const tour2Markers = page.locator('.leaflet-marker-icon');
      expect(await tour2Markers.count()).toBeGreaterThan(0);
      const tour2Box = await tour2Markers.first().boundingBox();
      expect(tour2Box).not.toBeNull();
      expect(tour2Box!.x !== initialBox!.x || tour2Box!.y !== initialBox!.y).toBe(true);
    });
  });
}
