import { test, expect } from '@playwright/test';

// Regressionstest für den Nord-/Fahrtrichtung-Umschalter (stores/mapOrientation.ts, TripMap.vue's
// toggleMapOrientation()/handleOrientation()): "Fahrtrichtung"-Modus dreht die Karte laufend mit dem
// Kompass-Heading mit (map.setBearing()), "Norden"-Modus lässt die Kartendrehung unangetastet. Der
// Richtungskegel des eigenen Standort-Markers (utils/mapRoute.ts's compassPin()) muss die
// Kartendrehung dabei ausgleichen, sonst zeigt er nach einer Drehung in die falsche Richtung.
test.use({ geolocation: { latitude: 48.2, longitude: 16.37 }, permissions: ['geolocation'] });

function rotationAngleFromMatrix(matrix: string): number {
  // matrix(a, b, c, d, tx, ty) - für eine reine Rotation gilt a=cos(θ), b=sin(θ).
  const values = matrix.match(/matrix\(([^)]+)\)/)?.[1].split(',').map(Number);
  if (!values) return NaN;
  const [a, b] = values;
  return (Math.atan2(b, a) * 180) / Math.PI;
}

test.describe('Karten-Rotation (Norden/Fahrtrichtung-Umschalter)', () => {
  test('Fahrtrichtung-Modus dreht die Karte auf den Kompass-Heading, Norden-Modus nicht', async ({ page }) => {
    await page.goto('/excursions');
    // Norden/Fahrtrichtung-Umschalter lebt hinter dem "Standort & Ausrichtung"-Popover (siehe
    // TripMap.vue's .location-btn/locationMenuOpen) statt eines eigenen, immer sichtbaren Buttons.
    const locationBtn = page.locator('.location-btn');
    await expect(locationBtn).toBeVisible({ timeout: 10_000 });

    // Standardmäßig "Norden" (🧭) - Kompass-Events verändern die Kartendrehung NICHT. Die
    // Rotations-Pane (leaflet-rotate) existiert unabhängig vom Modus immer, bleibt hier aber bei
    // 0° (Identitäts-Transform).
    await locationBtn.click();
    await expect(page.getByRole('button', { name: 'Norden oben' })).toHaveClass(/active/);
    await page.locator('.picker-backdrop').click();
    await page.evaluate(() => {
      const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      const event = new Event(eventName) as DeviceOrientationEvent & { alpha: number; absolute: boolean };
      Object.defineProperty(event, 'alpha', { value: 270 }); // Heading = 90°
      Object.defineProperty(event, 'absolute', { value: true });
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(300);
    const idleTransform = await page.locator('.leaflet-rotate-pane').evaluate((el) => getComputedStyle(el).transform);
    expect(Math.abs(rotationAngleFromMatrix(idleTransform))).toBeLessThan(1);

    // Umschalten auf "Fahrtrichtung" (🔭) - ab jetzt dreht sich die Karte mit dem Heading mit.
    await locationBtn.click();
    await page.getByRole('button', { name: 'Fahrtrichtung oben' }).click();
    await locationBtn.click();
    await expect(page.getByRole('button', { name: 'Fahrtrichtung oben' })).toHaveClass(/active/);
    await page.locator('.picker-backdrop').click();

    await page.evaluate(() => {
      const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
      const event = new Event(eventName) as DeviceOrientationEvent & { alpha: number; absolute: boolean };
      Object.defineProperty(event, 'alpha', { value: 270 }); // Heading = 90°
      Object.defineProperty(event, 'absolute', { value: true });
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(300);

    // Keine toBeVisible()-Prüfung: die Pane selbst ist ein 0x0-Positionierungscontainer (nur ihre
    // Kind-Elemente haben sichtbare Ausmaße), gilt also unabhängig vom Rotationszustand als
    // "unsichtbar" im Playwright-Sinn.
    const rotatePane = page.locator('.leaflet-rotate-pane');
    await expect(rotatePane).toHaveCount(1);
    const transform = await rotatePane.evaluate((el) => getComputedStyle(el).transform);
    expect(Math.abs(rotationAngleFromMatrix(transform) - 90)).toBeLessThan(1);

    // Der Richtungskegel gleicht die Kartendrehung aus - bei bearing===heading zeigt er (unrotiert)
    // gerade nach oben, siehe TripMap.vue's renderPositions()/coneRotation-Berechnung.
    const cone = page.locator('.own-location-cone');
    await expect(cone).toBeVisible();
    const coneTransform = await cone.evaluate((el) => getComputedStyle(el).transform);
    expect(Math.abs(rotationAngleFromMatrix(coneTransform))).toBeLessThan(1);
  });
});
