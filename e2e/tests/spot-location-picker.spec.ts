import { test, expect } from '@playwright/test';

// Regressionstest für einen vom Nutzer gemeldeten Bug: L.map(mapEl.value) (ohne Options-Objekt) in
// LocationPicker.vue crashte in leaflet-rotate's global gepatchtem L.Map.initialize ("Cannot read
// properties of undefined (reading 'rotate')"), sobald bereits eine andere Karte mit dem
// 'leaflet-rotate'-Side-Effect-Import (TripMap.vue) im selben View gemountet war - genau der Fall
// bei "Neuer Spot" in ExcursionsView.vue, das TripMap.vue direkt daneben rendert. Die Mini-Karte
// blieb dadurch komplett leer. Fix: L.map(mapEl.value, {}) statt ohne Options-Objekt.
test.describe('Standort manuell setzen (Spot-Formular)', () => {
  test('die Mini-Karte rendert tatsächliche Kartenkacheln statt leer zu bleiben', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Neuer Spot' }).click();
    const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
    await modal.locator('.location-fieldset .collapsible-toggle').click();
    await modal.locator('button.picker-toggle').click();

    const mapDiv = modal.locator('.location-picker-map');
    await expect(mapDiv.locator('.leaflet-tile-pane')).toBeAttached();
    expect(pageErrors.join('\n')).not.toContain("reading 'rotate'");
  });

  test.use({
    geolocation: { latitude: 48.2082, longitude: 16.3738 },
    permissions: ['geolocation'],
  });

  test('"Meinen aktuellen Standort verwenden" setzt den Pin auf die ermittelte Position', async ({
    page,
  }) => {
    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Neuer Spot' }).click();
    const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
    await modal.locator('.location-fieldset .collapsible-toggle').click();
    await modal.locator('button.picker-toggle').click();

    await modal.locator('.locate-btn').click();
    await expect(modal.locator('.hint.success')).toContainText('48.20820, 16.37380');
  });
});
