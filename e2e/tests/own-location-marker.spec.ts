import { test, expect } from '@playwright/test';

// Regressionstest für den eigenen Standort-Marker auf der großen Karte (utils/mapRoute.ts's
// compassPin(), TripMap.vue's renderPositions()): vorher ein Emoji-Pin-Ballon (wie andere Punkte
// auch), jetzt bewusst ein Kreis mit optionalem Richtungskegel (Smartphone-Kompass), um die
// Orientierung auf der Karte zu erleichtern - siehe .own-location-marker/.own-location-cone.
test.use({ geolocation: { latitude: 48.2, longitude: 16.37 }, permissions: ['geolocation'] });

test.describe('Eigener Standort-Marker', () => {
  test('rendert als Kreis-Marker statt als Emoji-Pin-Ballon', async ({ page }) => {
    await page.goto('/excursions');
    const ownMarker = page.locator('.leaflet-pane.leaflet-live-positions-pane .own-location-marker');
    await expect(ownMarker).toBeVisible({ timeout: 10_000 });
  });

  test('zeigt einen Richtungskegel, sobald ein Kompass-Wert vorliegt', async ({ page }) => {
    await page.goto('/excursions');
    const ownMarker = page.locator('.leaflet-pane.leaflet-live-positions-pane .own-location-marker');
    await expect(ownMarker).toBeVisible({ timeout: 10_000 });

    // Ohne jeden Sensor-Wert (wie hier im Test, kein echtes Gerät) bleibt der Kegel weg - nur der
    // Punkt ist sichtbar, siehe compassPin()'s headingDeg===null-Fall.
    await expect(page.locator('.own-location-cone')).toHaveCount(0);

    // Simuliert ein 'deviceorientationabsolute'-Event (Android/Chrome) - siehe
    // TripMap.vue's headingFromOrientationEvent()/startCompass().
    await page.evaluate(() => {
      const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      const event = new Event(eventName) as DeviceOrientationEvent & { alpha: number; absolute: boolean };
      Object.defineProperty(event, 'alpha', { value: 0 });
      Object.defineProperty(event, 'absolute', { value: true });
      window.dispatchEvent(event);
    });

    const cone = page.locator('.own-location-cone');
    await expect(cone).toBeVisible();
    // alpha=0 -> Heading (360-0)%360 = 0 = Norden -> Kegel zeigt ohne Rotation nach oben (nur der
    // durch die Border-Box bedingte Verschiebungsanteil von translate(-50%,-100%) bleibt bei
    // rotate(0deg) übrig, siehe compassPin()).
    await expect(cone).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -9, -22)');
  });
});
