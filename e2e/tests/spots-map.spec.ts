import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8')
);
const tripId = seeded.trip.id;

// Regressionstest für den neuen "✅ Gemacht"-Status-Filter (ExcursionsView.vue's statusFilter/
// itemDone()) - unabhängig von planned/unplanned per ODER kombinierbar (ein Spot kann gleichzeitig
// geplant UND gemacht sein), deshalb eigener Test statt nur einer Erweiterung des bestehenden
// Kategorie-Filter-Tests oben.
test.describe('Spots-Liste: "Gemacht"-Status-Filter', () => {
  test('Filtern nach "✅ Gemacht" zeigt nur als gemacht markierte Spots', async ({ page }) => {
    const marker = `E2E-GemachtFilter-${Date.now()}`;
    const doneTitle = `Erledigt ${marker}`;
    const openTitle = `Noch offen ${marker}`;

    const doneRes = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: doneTitle, category: 'Sonstiges' },
    });
    expect(doneRes.ok()).toBeTruthy();
    const doneSpot = await doneRes.json();
    // #106: "gemacht" braucht seither ein verknüpftes Datum - erst einplanen, dann erst markieren
    // (Reihenfolge ist seit #106 verpflichtend, siehe backend/routes/spots.ts's /done-Endpunkt).
    const scheduleRes = await page.request.post('/api/schedule', {
      data: { trip_id: tripId, date: '2026-01-02', title: doneTitle, spot_id: doneSpot.id },
    });
    expect(scheduleRes.ok()).toBeTruthy();
    const toggleRes = await page.request.post(`/api/spots/${doneSpot.id}/done`, {
      data: { done: true },
    });
    expect(toggleRes.ok()).toBeTruthy();

    const openRes = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: openTitle, category: 'Sonstiges' },
    });
    expect(openRes.ok()).toBeTruthy();

    await page.goto('/excursions');
    await expect(page.locator('.spot-card', { hasText: doneTitle })).toBeVisible();
    await expect(page.locator('.spot-card', { hasText: openTitle })).toBeVisible();

    await page.waitForSelector('.search-filter-bar');
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    const gemachtOption = page.locator('.dropdown-item', { hasText: 'Gemacht' });
    await gemachtOption.evaluate((el: HTMLElement) => el.click());
    await page.locator('.picker-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.picker-backdrop')).toBeHidden();

    await expect(page.locator('.spot-card', { hasText: doneTitle })).toBeVisible();
    await expect(page.locator('.spot-card', { hasText: openTitle })).toHaveCount(0);

    // Aufräumen: Filter zurücksetzen, damit er nicht in andere Tests dieser Suite durchsickert.
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    const gemachtOptionReset = page.locator('.dropdown-item', { hasText: 'Gemacht' });
    await gemachtOptionReset.evaluate((el: HTMLElement) => el.click());
    await page.locator('.picker-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.picker-backdrop')).toBeHidden();
  });
});

test.describe('Spots-Karte: Kategorie-Filter wird zuverlässig auf die Marker angewendet', () => {
  // Regressionstest für einen vom Nutzer gemeldeten Bug: der Kategorie-/Status-Filter aus der
  // Spots-Liste wirkte sich zwar auf filteredPoints/visiblePoints (computed) in TripMap.vue aus,
  // aber nichts beobachtete diese Props, um renderMarkers() (eine reine, imperative Funktion, kein
  // reaktiver Template-Ausdruck) danach erneut aufzurufen - die Karte blieb auf dem zuletzt
  // gezeichneten Stand hängen, bis irgendein ANDERER beobachteter Zustand (Fokus, Tripwechsel, …)
  // zufällig ebenfalls ein renderMarkers() auslöste. Fix: eigener watch() auf
  // categoryFilter/statusFilter in TripMap.vue.
  test('Marker-Anzahl sinkt sofort, wenn eine Kategorie gefiltert wird', async ({ page }) => {
    await page.goto('/excursions');
    await page.waitForSelector('.leaflet-marker-icon');
    // Kurze Ruhe, bis alle Marker (Spots + Unterkunft/Reise) tatsächlich gezeichnet sind.
    await page.waitForTimeout(300);
    const markers = page.locator('.leaflet-marker-icon');
    const beforeCount = await markers.count();
    expect(beforeCount).toBeGreaterThan(1);

    await page.waitForSelector('.search-filter-bar');
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    // Erste Kategorie-Checkbox aus dem Menü wählen - welche das genau ist, ist für diesen Test
    // irrelevant, nur dass danach WENIGER Marker als vorher sichtbar sind.
    const firstCatOption = page.locator('.category-option').first();
    await firstCatOption.waitFor();
    await firstCatOption.evaluate((el: HTMLElement) => el.click());
    await page.locator('.picker-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.picker-backdrop')).toBeHidden();

    await expect(async () => {
      const afterCount = await markers.count();
      expect(afterCount).toBeLessThan(beforeCount);
    }).toPass({ timeout: 5000 });
  });

  test('MapsAppPicker in SpotCard is not clipped by the card or accordion', async ({ page }) => {
    const marker = `E2E-SpotMapPicker-${Date.now()}`;
    const spotRes = await page.request.post('/api/spots', {
      data: {
        trip_id: tripId,
        title: `Spot ${marker}`,
        category: 'Sonstiges',
        lat: 38.6916,
        lng: -9.2159,
        maps_link: 'https://www.google.com/maps/@38.6916,-9.2159,17z',
      },
    });
    expect(spotRes.ok()).toBeTruthy();

    await page.goto('/excursions');
    const card = page.locator('.spot-card', { hasText: `Spot ${marker}` });
    await expect(card).toBeVisible();

    // Aufklappen der Card
    await card.click();
    await expect(card).toHaveClass(/expanded/);

    // Button "In Karten-App öffnen" klicken
    const mapsBtn = card.getByRole('button', { name: 'In Karten-App öffnen' });
    await expect(mapsBtn).toBeVisible();
    await mapsBtn.click();

    // Menü per Teleport gerendert und sichtbar
    const appleMaps = page.getByRole('link', { name: 'Apple Maps' });
    const googleMaps = page.getByRole('link', { name: 'Google Maps' });
    await expect(appleMaps).toBeVisible();
    await expect(googleMaps).toBeVisible();

    const menuBox = await page.locator('.maps-picker-menu').boundingBox();
    const viewport = page.viewportSize();
    expect(menuBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (menuBox && viewport) {
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.y).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    }
  });
});
