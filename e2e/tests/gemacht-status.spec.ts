import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));
const tripId = seeded.trip.id;

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Regressionsnetz für den neuen unabhängigen "gemacht"-Status auf Spots/Touren (siehe CLAUDE.md,
// Entscheidungen: eigenes Flag neben geplant/ungeplant, direkt auf beiden Tabellen setzbar, im
// Tagebuch-Formular per Checkbox/Spot-Picker zusätzlich automatisch gesetzt).
test.describe('"Gemacht"-Status: Spots/Touren', () => {
  test('lässt sich direkt auf einem nie geplanten Spot umschalten und übersteht ein Neuladen', async ({ page }) => {
    const marker = `E2E-Gemacht-${Date.now()}`;
    const spotTitle = `Spontanbesuch ${marker}`;

    const created = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await expect(spotCard).toBeVisible();
    // Karte aufklappen, damit der Umschalt-Button (nur im aufgeklappten Zustand sichtbar) erreichbar ist.
    await spotCard.click();

    const toggle = spotCard.locator('.done-toggle');
    await expect(toggle).toHaveText('⬜️ Als gemacht markieren');
    await toggle.click();
    await expect(toggle).toHaveText('✅ Gemacht');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(spotCard.locator('.status.status-done')).toBeVisible();

    await page.reload();
    const spotCardAfterReload = page.locator('.spot-card', { hasText: spotTitle });
    await spotCardAfterReload.click();
    await expect(spotCardAfterReload.locator('.done-toggle')).toHaveText('✅ Gemacht');
  });

  test('Tagebuch: für heute geplante Vorschläge sind als "Empfohlen" markiert, Anhaken setzt automatisch gemacht=true', async ({
    page,
  }) => {
    const marker = `E2E-Diary-Gemacht-${Date.now()}`;
    const tourTitle = `Altstadt-Rundgang ${marker}`;
    const spotTitle = `Café Central ${marker}`;
    const today = localDateStr(new Date());

    // Tour, für heute eingeplant (date === today macht sie im Picker zum "Empfohlen"-Vorschlag).
    const tourRes = await page.request.post('/api/ideas', {
      data: { trip_id: tripId, title: tourTitle, date: today },
    });
    expect(tourRes.ok()).toBeTruthy();
    const tour = await tourRes.json();
    expect(tour.done).toBe(0);

    // Spot, NICHT geplant - wird über den Spot-Picker-Button (nicht die Checkbox-Liste) manuell
    // hinzugefügt, kein "Empfohlen"-Badge erwartet.
    const spotRes = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Restaurant' },
    });
    expect(spotRes.ok()).toBeTruthy();
    const spot = await spotRes.json();
    expect(spot.done).toBe(0);

    await page.goto('/diary');
    await page.getByRole('button', { name: '+ Neuer Eintrag' }).click();
    const modal = page.locator('.modal', { hasText: 'Neuer Tagebucheintrag' });
    await expect(modal.locator('input[type="date"]')).toHaveValue(today);

    // Die für heute geplante Tour ist bereits vorausgewählt (bestehendes Verhalten) UND als
    // "Empfohlen" markiert.
    const tourOption = modal.locator('.excursion-option', { hasText: tourTitle });
    await expect(tourOption.locator('input[type="checkbox"]')).toBeChecked();
    await expect(tourOption.locator('.excursion-option-badge.recommended')).toHaveText(/Empfohlen/);

    const editor = modal.locator('.richtext-content[contenteditable="true"]');
    await editor.click();
    await editor.pressSequentially('Wir haben die Altstadt erkundet und sind spontan im Café eingekehrt.');

    // Spot manuell per Picker-Button hinzufügen (nicht vorab geplant, daher kein Empfohlen-Badge).
    const spotButton = modal.locator('.spot-option-btn', { hasText: spotTitle });
    await expect(spotButton.locator('.excursion-option-badge.recommended')).toHaveCount(0);
    await spotButton.click();
    await expect(spotButton.locator('.excursion-option-badge', { hasText: 'hinzugefügt' })).toBeVisible();

    await modal.locator('button[type="submit"]').click();
    await expect(modal).toBeHidden();

    // Beide verknüpften Objekte müssen jetzt automatisch als "gemacht" markiert sein. Touren-Karten
    // leben seit der Verschmelzung des früheren "erweiterten Touren-Modus" in der Spots-Sicht
    // (/excursions, Touren-Gruppierung) statt in einer eigenständigen Touren-Route.
    await page.goto('/excursions');
    await page.getByRole('button', { name: '🎒 Touren' }).click();
    const tourCard = page.locator('.excursion-card', { hasText: tourTitle });
    await expect(tourCard.locator('.status.status-done')).toBeVisible();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await spotCard.click();
    await expect(spotCard.locator('.done-toggle')).toHaveText('✅ Gemacht');
  });
});
