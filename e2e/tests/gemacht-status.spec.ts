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

// Regressionsnetz für die #106-Überarbeitung: Status-Kette in Planung -> geplant -> gemacht statt
// (wie zuvor) eines von geplant/ungeplant unabhängigen Flags - ein Spot/eine Tour kann nicht ohne
// Datum "gemacht" sein, der Übergang zu "gemacht" führt deshalb immer erst durch den Kalender
// (drawers.pendingSchedule mode 'confirm-done', ScheduleView.vue).
test.describe('"Gemacht"-Status: Spots/Touren', () => {
  test('Markieren als "gemacht" öffnet den Kalender zur Datumsbestätigung und übersteht ein Neuladen', async ({
    page,
  }) => {
    const marker = `E2E-Gemacht-${Date.now()}`;
    const spotTitle = `Spontanbesuch ${marker}`;
    const today = localDateStr(new Date());

    const created = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await expect(spotCard).toBeVisible();
    // Karte aufklappen, damit der Umschalt-Button (nur im aufgeklappten Zustand sichtbar) erreichbar
    // ist. Gezielt auf den Titel statt auf die ganze Karte klicken (gleiches Muster wie
    // map-focus-covered-drawer.spec.ts): ein Klick auf .spot-card selbst landet bei Playwright am
    // geometrischen Mittelpunkt der Karte - der kann in der kompakten Zeilen-Ansicht (schmale
    // .spots-col, z. B. bei geöffneter Kalender-Schublade auf Desktop) zufällig genau auf einem der
    // SocialRow-Buttons (🤍/💬) liegen, die selbst @click.stop setzen und das Aufklappen verhindern.
    await spotCard.locator('h3').click();

    // aria-label statt sichtbarem Text: der Toggle (group="actions") zeigt seit #168 immer ein
    // SVG-Icon statt eines Emoji-Zeichens (siehe stores/iconStyle.ts), aria-label/title bleiben die
    // stabile, stilunabhängige Quelle für den Zustand.
    const toggle = spotCard.locator('.done-toggle');
    await expect(toggle).toHaveAttribute('aria-label', 'Als gemacht markieren');
    await toggle.click();

    // Kalender-Schublade ist auf Desktop bereits offen - der Bestätigungs-Hinweis ersetzt hier den
    // normalen Einplanen-Hinweis (siehe ScheduleView.vue's pending-schedule-banner).
    const banner = page.locator('.pending-schedule-banner');
    await expect(banner).toContainText(spotTitle);
    await expect(banner).toContainText('besucht');
    await page.locator(`.day[data-date="${today}"]`).click();
    await expect(banner).toBeHidden();

    // #147: kein Textlabel mehr im "gemacht"-Zustand (nur noch das Icon) - das Datums-/Status-Badge
    // auf dem Vorschaubild zeigt den Status bereits an, ein zweites "Gemacht"-Label wäre eine
    // unnötige Dopplung.
    await expect(toggle).toHaveAttribute('aria-label', 'Nicht mehr als gemacht markiert');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(spotCard.locator('.status.status-done')).toContainText('Besucht am');

    await page.reload();
    const spotCardAfterReload = page.locator('.spot-card', { hasText: spotTitle });
    await spotCardAfterReload.locator('h3').click();
    await expect(spotCardAfterReload.locator('.done-toggle')).toHaveAttribute('aria-label', 'Nicht mehr als gemacht markiert');
  });

  test('Markieren als "gemacht" auf einem bereits geplanten Spot öffnet den Kalender NICHT (#147)', async ({
    page,
  }) => {
    const marker = `E2E-Gemacht-Direkt-${Date.now()}`;
    const spotTitle = `Bereits geplant ${marker}`;
    const plannedDate = '2026-03-15';

    const created = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
    });
    expect(created.ok()).toBeTruthy();
    const spot = await created.json();
    const scheduleRes = await page.request.post('/api/schedule', {
      data: { trip_id: tripId, date: plannedDate, title: spotTitle, spot_id: spot.id },
    });
    expect(scheduleRes.ok()).toBeTruthy();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await spotCard.locator('h3').click();
    await expect(spotCard.locator('.status.planned')).toContainText('Geplant für');

    await spotCard.locator('.done-toggle').click();

    // Kein Kalender-Bestätigungs-Flow - das bereits vorhandene geplante Datum wird direkt als
    // Gemacht-/Besucht-Datum übernommen.
    await expect(page.locator('.pending-schedule-banner')).toBeHidden();
    await expect(spotCard.locator('.done-toggle')).toHaveAttribute('aria-label', 'Nicht mehr als gemacht markiert');
    await expect(spotCard.locator('.status.status-done')).toContainText('Besucht am 15.03');
  });

  test('Abbrechen im Kalender-Bestätigungs-Flow lässt den Status unverändert', async ({ page }) => {
    const marker = `E2E-Gemacht-Abbrechen-${Date.now()}`;
    const spotTitle = `Spontanbesuch ${marker}`;

    const created = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
    });
    expect(created.ok()).toBeTruthy();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await spotCard.locator('h3').click();
    await spotCard.locator('.done-toggle').click();

    const banner = page.locator('.pending-schedule-banner');
    await expect(banner).toContainText(spotTitle);
    await banner.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(banner).toBeHidden();

    await expect(spotCard.locator('.done-toggle')).toHaveAttribute('aria-label', 'Als gemacht markieren');
    await expect(spotCard.locator('.status')).toHaveCount(0);
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
    await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
    const modal = page.locator('.modal', { hasText: 'Neuer Tagebucheintrag' });
    await expect(modal.locator('input[type="date"]')).toHaveValue(today);

    // Die für heute geplante Tour ist bereits vorausgewählt (bestehendes Verhalten) UND als
    // "Empfohlen" markiert.
    const tourOption = modal.locator('.excursion-option', { hasText: tourTitle });
    await expect(tourOption.locator('input[type="checkbox"]')).toBeChecked();
    await expect(tourOption.locator('.excursion-option-badge.recommended')).toHaveText(/Empfohlen/);

    // Kurzes Settle vor der Editor-Interaktion, statt page.waitForLoadState('networkidle') (frühere
    // Version): die App hält für Echtzeit-Sync dauerhaft eine offene SSE-Verbindung
    // (/realtime/stream, siehe CLAUDE.md "Echtzeit-Sync") - "networkidle" wartet auf keine aktiven
    // Netzwerkverbindungen und wurde dadurch nie zuverlässig erreicht, lief im schlimmsten Fall bis
    // zum vollen Test-Timeout (beobachtete CI-Flakiness). Die Touren-/Spot-Picker-Listen sind an
    // dieser Stelle ohnehin schon geladen (die tourOption-Assertions oben warten bereits implizit
    // darauf) - ein fester kurzer Wait reicht als reines Layout-/Font-Settle, analog zum
    // bestehenden Muster in anderen Specs (z. B. map-focus-covered-drawer.spec.ts).
    await page.waitForTimeout(300);
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
    await modal.getByRole('button', { name: 'Spots zuordnen' }).click();

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
    await page.getByRole('button', { name: 'Touren' }).click();
    const tourCard = page.locator('.excursion-card', { hasText: tourTitle });
    await expect(tourCard.locator('.status.status-done')).toBeVisible();

    await page.goto('/excursions');
    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    // Titel statt ganzer Karte anklicken - siehe Kommentar im ersten Test dieser Datei.
    await spotCard.locator('h3').click();
    await expect(spotCard.locator('.done-toggle')).toHaveAttribute('aria-label', 'Nicht mehr als gemacht markiert');
  });

  test.describe('Status-Badges ragen auf schmalen Breiten nicht über das Vorschaubild hinaus', () => {
    test.use({ viewport: VIEWPORTS.mobile });

    // Regressionstest für einen bereits einmal gefixten Bug (siehe SpotCard.vue's .status/
    // .status-text): in der kompakten, nicht aufgeklappten Kartenzeile (@container spots-col
    // (max-width: 480px)) schrumpft .image auf 64px - die Status-Pille (Icon+Text) war dort
    // strukturell breiter als ihr eigener Positionierungs-Kontext und lief in den Titel/
    // Kategorie-Bereich daneben hinein. Seit #106 gibt es nur noch EIN gemeinsames Datums-/
    // Status-Badge statt zweier gleichzeitig sichtbarer Chips (das alte separate
    // "Gemacht"-Badge entfiel) - die verlangt ihr eigenes Datum, daher hier erst planen, dann
    // erst als gemacht markieren (Reihenfolge ist seit #106 verpflichtend).
    test('gemachter Spot: das Status-Badge bleibt innerhalb von .image', async ({ page }) => {
      const marker = `E2E-StatusOverflow-${Date.now()}`;
      const spotTitle = `Überlauf-Check ${marker}`;

      const created = await page.request.post('/api/spots', {
        data: { trip_id: tripId, title: spotTitle, category: 'Sonstiges' },
      });
      expect(created.ok()).toBeTruthy();
      const spot = await created.json();

      const scheduleRes = await page.request.post('/api/schedule', {
        data: { trip_id: tripId, date: localDateStr(new Date()), title: spotTitle, spot_id: spot.id },
      });
      expect(scheduleRes.ok()).toBeTruthy();

      const doneRes = await page.request.post(`/api/spots/${spot.id}/done`, { data: { done: true } });
      expect(doneRes.ok()).toBeTruthy();

      await page.goto('/excursions');
      const spotCard = page.locator('.spot-card', { hasText: spotTitle });
      // NICHT aufklappen - die kompakte, nicht-expandierte Kartenzeile ist genau der Fall, in dem
      // der Bug auftrat (.spot-card.expanded nutzt weiterhin die volle Pillen-Darstellung).
      await expect(spotCard).toBeVisible();
      const image = spotCard.locator('.image');
      await expectWithinBox(spotCard.locator('.status.status-done'), image);
    });
  });
});
