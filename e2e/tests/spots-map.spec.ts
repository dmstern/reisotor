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
    await page.getByRole('checkbox', { name: /Gemacht/ }).check();
    await page.locator('.picker-backdrop').click();

    await expect(page.locator('.spot-card', { hasText: doneTitle })).toBeVisible();
    await expect(page.locator('.spot-card', { hasText: openTitle })).toHaveCount(0);

    // Aufräumen: Filter zurücksetzen, damit er nicht in andere Tests dieser Suite durchsickert.
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    await page.getByRole('checkbox', { name: /Gemacht/ }).uncheck();
    await page.locator('.picker-backdrop').click();
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
    await page.locator('.category-option').first().waitFor();
    await page
      .locator('.category-option')
      .first()
      .locator('input[type="checkbox"]')
      .check({ force: true });
    await page.locator('.picker-backdrop').click();

    await expect(async () => {
      const afterCount = await markers.count();
      expect(afterCount).toBeLessThan(beforeCount);
    }).toPass({ timeout: 5000 });
  });
});
