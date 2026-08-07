import { test, expect } from '@playwright/test';

// Regressionstest für einen bereits einmal gefixten UX-Bug (TripMap.vue's centerOnPoint()/
// fitBoundsWithCoveredBottom()): auf Mobil überlagert die Spots-Schublade (.spots-col) als
// Bottom-Sheet den unteren Teil der Karte. Ein fokussierter Punkt/Ausschnitt darf deshalb nicht im
// Zentrum des GESAMTEN Karten-Containers landen, sondern muss im Zentrum der tatsächlich sichtbaren
// (nicht überlagerten) Fläche erscheinen - sonst landet er optisch hinter der Schubladen-Kante.
// centerOnPoint() (Einzelpunkt) deckte das bereits ab; fitBoundsWithCoveredBottom() (mehrere Punkte,
// z. B. "Alle anzeigen"/Ausflug-/Tages-Fokus) nutzte bis zu diesem Fix stattdessen symmetrisches
// Padding und ignorierte die Schublade komplett.
test.use({ viewport: { width: 390, height: 844 } });

test.describe('Karten-Fokus berücksichtigt die halb geöffnete Spots-Schublade (mobil)', () => {
  test('fokussierter Einzelpunkt (Spot-Klick) landet oberhalb der Schubladen-Kante', async ({ page }) => {
    await page.goto('/excursions');
    await expect(page.locator('.spots-col')).toBeVisible();
    const sheetBox = await page.locator('.spots-col').boundingBox();
    expect(sheetBox).not.toBeNull();

    // Titel statt der ganzen Karte anklicken - ein Klick auf die Karten-Mitte kann auf einem der
    // @click.stop-Anfasser (Einplanen/Auf Tour ziehen) weiter unten landen, ohne den Fokus/die
    // Zentrierung überhaupt auszulösen.
    await page.locator('.spot-card').first().locator('h3').click();
    await page.waitForTimeout(400);

    const marker = page.locator('.leaflet-marker-icon').first();
    await expect(marker).toBeVisible();
    const markerBox = await marker.boundingBox();
    expect(markerBox).not.toBeNull();
    if (markerBox && sheetBox) {
      expect(markerBox.y + markerBox.height).toBeLessThan(sheetBox.y);
    }
  });

  test('"Alle anzeigen" (mehrere Punkte) bleibt komplett oberhalb der Schubladen-Kante', async ({ page }) => {
    await page.goto('/excursions');
    await expect(page.locator('.spots-col')).toBeVisible();
    const sheetBox = await page.locator('.spots-col').boundingBox();
    expect(sheetBox).not.toBeNull();

    await page.locator('.fit-btn').first().click(); // 🔍 "Alle eingetragenen Orte anzeigen"
    await page.waitForTimeout(400);

    const markers = page.locator('.leaflet-marker-icon');
    const count = await markers.count();
    expect(count).toBeGreaterThan(1); // sonst testet dieser Fall nicht wirklich den fitBounds()-Pfad
    for (let i = 0; i < count; i++) {
      const box = await markers.nth(i).boundingBox();
      expect(box).not.toBeNull();
      if (box && sheetBox) {
        expect(box.y + box.height).toBeLessThan(sheetBox.y);
      }
    }
  });
});
