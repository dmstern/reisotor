import { test, expect } from '@playwright/test';

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

    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    // Erste Kategorie-Checkbox aus dem Menü wählen - welche das genau ist, ist für diesen Test
    // irrelevant, nur dass danach WENIGER Marker als vorher sichtbar sind.
    await page.locator('.category-option').first().locator('input[type="checkbox"]').check();
    await page.locator('.picker-backdrop').click();

    await expect(async () => {
      const afterCount = await markers.count();
      expect(afterCount).toBeLessThan(beforeCount);
    }).toPass({ timeout: 5000 });
  });
});
