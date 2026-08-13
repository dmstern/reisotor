import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, expectWithinBox } from './helpers/layout';

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

    // Wartet, bis alle beim Öffnen ausgelösten Requests (Touren-/Spot-Picker-Listen etc.) fertig
    // sind, bevor mit dem Editor interagiert wird.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    const editor = modal.locator('.richtext-content[contenteditable="true"]');
    await editor.scrollIntoViewIfNeeded();
    // .focus() statt .click(): auf dem CI-Runner (nie lokal reproduzierbar, auch nach mehreren
    // App-seitigen Layout-Shift-Fixes nicht) meldete ein echter Maus-Klick hier wiederholt
    // "intercepts pointer events" durch benachbarte Formularfelder (Titel-Input, Bild-Upload) -
    // Playwrights Hit-Test an der Klickposition traf dort offenbar zuverlässig daneben, obwohl das
    // Zielelement selbst laut Playwright bereits "visible, enabled and stable" war. Für diesen Test
    // kommt es nur darauf an, Text in den Editor zu bekommen, nicht das Klick-Verhalten selbst zu
    // prüfen - .focus() setzt den Fokus direkt, ganz ohne Hit-Test an einer Bildschirmposition.
    await editor.focus();
    await editor.pressSequentially('Wir haben die Altstadt erkundet und sind spontan im Café eingekehrt.');

    // Spot-Picker ist standardmäßig eingeklappt (spart Platz, siehe DiaryView.vue), muss also erst
    // aufgeklappt werden, bevor der Picker-Button für den manuellen Spot erreichbar ist.
    await modal.getByRole('button', { name: '📍 Spots zuordnen' }).click();

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

  test.describe('Status-Badges ragen auf schmalen Breiten nicht über das Vorschaubild hinaus', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    // Regressionstest für einen bereits einmal gefixten Bug (siehe SpotCard.vue's .status/
    // .status-text): in der kompakten, nicht aufgeklappten Kartenzeile (@container spots-col
    // (max-width: 480px)) schrumpft .image auf 64px - die Status-Pillen (Icon+Text) waren dort
    // strukturell breiter als ihr eigener Positionierungs-Kontext und liefen in den Titel/
    // Kategorie-Bereich daneben hinein. Deckt beide gleichzeitig sichtbaren Badges ab (geplant UND
    // gemacht), da beide unabhängig voneinander an je einer unteren Ecke von .image verankert sind.
    test('geplanter UND gemachter Spot: beide Status-Kreise bleiben innerhalb von .image', async ({ page }) => {
      const marker = `E2E-StatusOverflow-${Date.now()}`;
      const spotTitle = `Überlauf-Check ${marker}`;

      const created = await page.request.post('/api/spots', {
        data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
      });
      expect(created.ok()).toBeTruthy();
      const spot = await created.json();

      const doneRes = await page.request.post(`/api/spots/${spot.id}/done`, { data: { done: true } });
      expect(doneRes.ok()).toBeTruthy();

      const scheduleRes = await page.request.post('/api/schedule', {
        data: { trip_id: tripId, date: localDateStr(new Date()), title: spotTitle, spot_id: spot.id },
      });
      expect(scheduleRes.ok()).toBeTruthy();

      await page.goto('/excursions');
      const spotCard = page.locator('.spot-card', { hasText: spotTitle });
      // NICHT aufklappen - die kompakte, nicht-expandierte Kartenzeile ist genau der Fall, in dem
      // der Bug auftrat (.spot-card.expanded nutzt weiterhin die volle Pillen-Darstellung).
      await expect(spotCard).toBeVisible();
      const image = spotCard.locator('.image');
      await expectWithinBox(spotCard.locator('.status.status-done'), image);
      await expectWithinBox(spotCard.locator('.status.planned'), image);
    });
  });
});
