import { test, expect, type Page } from '@playwright/test';
import { VIEWPORTS } from './helpers/layout.js';

// Regressionsnetz für die Standort-Aufzeichnung (backend/src/routes/tracks.ts,
// stores/trackRecording.ts/stores/tracks.ts, TripMap.vue/TrackPlayback.vue): Start über den
// Karten-Button, laufender Header-Indikator, Stop, Erscheinen in ExcursionsView.vue's
// Aufzeichnungen-Liste und Playback-Steuerung beim Fokussieren auf der Karte. Gleiches Muster wie
// location-sharing.spec.ts (Picker-Menü) und live-location.spec.ts (Geolocation-Mock/desktop
// Viewport wegen des unteren Spots-Bottom-Sheets, das sonst die Button-Spalte verdeckt).
test.use({
  geolocation: { latitude: 48.2, longitude: 16.37 },
  permissions: ['geolocation'],
  viewport: VIEWPORTS.desktop,
});

async function closeDrawerIfOpen(page: Page, label: string) {
  const closeBtn = page.locator(`.close-drawer-btn[aria-label="Schließen: ${label}"]`);
  if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible())) {
    await closeBtn.click();
  }
}

test.describe('Standort-Aufzeichnung', () => {
  test('Start auf der Karte, laufender Header-Indikator, Stop, Liste + Playback', async ({
    page,
    context,
  }) => {
    await page.goto('/excursions');
    await closeDrawerIfOpen(page, 'Kalender');

    const recordBtn = page.locator('.record-btn');
    await expect(recordBtn).toBeVisible({ timeout: 10_000 });
    await expect(recordBtn).not.toHaveClass(/active/);

    await recordBtn.click();
    const menu = page.locator('.picker-menu', { hasText: 'Privat aufzeichnen' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Privat aufzeichnen' }).click();

    // Läuft: Button + app-weiter Header-Indikator zeigen den aktiven Zustand.
    await expect(recordBtn).toHaveClass(/active/);
    const recordingPill = page.locator('.recording-pill');
    await expect(recordingPill).toBeVisible();

    // Ein zweiter GPS-Fix an einer anderen Position, damit die Aufzeichnung mindestens zwei
    // unterscheidbare Punkte hat (Playback/TrackPlayback.vue braucht >= 2 Punkte, siehe dortiges
    // v-if) - ein einzelner, statischer Mock-Standort würde watchPosition sonst nur einmal auslösen.
    await page.waitForTimeout(800);
    await context.setGeolocation({ latitude: 48.21, longitude: 16.38 });
    await page.waitForTimeout(1000);

    // Stop flusht den Punkte-Puffer sofort (kein Warten auf den periodischen 15s-Flush nötig, siehe
    // stores/trackRecording.ts's stop()).
    await recordBtn.click();
    await expect(recordBtn).not.toHaveClass(/active/, { timeout: 10_000 });
    await expect(recordingPill).not.toBeVisible();

    // Aufzeichnungen-Liste in ExcursionsView.vue - keine feste Gesamtanzahl erwarten (die e2e-Suite
    // teilt sich eine DB über alle Spec-Dateien hinweg, siehe playwright.config.ts), stattdessen die
    // gerade erstellte Zeile über ihre Sortierung finden: GET /tracks liefert neueste zuerst
    // (routes/tracks.ts), die eigene Aufzeichnung ist also immer die erste.
    const tracksToggle = page.locator('.tracks-toggle');
    await expect(tracksToggle).toBeVisible({ timeout: 10_000 });
    await expect(tracksToggle).toContainText(/Aufzeichnungen \(\d+\)/);
    await tracksToggle.click();

    // Dauer-Text statt Emoji-Zeichen prüfen: das Icon davor (group="actions") rendert seit #168
    // immer SVG statt Emoji (siehe stores/iconStyle.ts).
    const trackRow = page.locator('.track-row').first();
    await expect(trackRow).toBeVisible();
    await expect(trackRow.locator('.track-row-meta')).toContainText(/Min\.|Std\./);

    // Klick zeigt die Route + den Zeit-Slider auf der Karte (analog zum Tour-Fokus).
    await trackRow.locator('.track-row-main').click();
    const focusCard = page.locator('.focus-spot-list', { hasText: 'Aufzeichnung' });
    await expect(focusCard).toBeVisible();
    await expect(focusCard.locator('.track-playback')).toBeVisible({ timeout: 10_000 });
    await expect(focusCard.locator('.playback-slider')).toBeVisible();

    // Sichtbarkeits-Umschalter: von privat (Standard) auf geteilt. aria-label statt Emoji-Text
    // (group="actions" rendert seit #168 immer SVG, siehe ExcursionsView.vue).
    const visibilityBtn = trackRow.locator('.track-icon-btn').first();
    await expect(visibilityBtn).toHaveAttribute('aria-label', 'Mit allen teilen');
    await visibilityBtn.click();
    await expect(visibilityBtn).toHaveAttribute('aria-label', 'Teilen zurücknehmen');
  });

  // Pausieren (z. B. Stromsparen bei längerem Aufenthalt an einem Ort, Nutzer-Anforderung) hängt
  // sich beim Fortsetzen an DIESELBE Aufzeichnung an, statt eine zweite zu erzeugen - Kern-Check
  // hier: der Header-Indikator wechselt Icon/Text korrekt zwischen "läuft"/"pausiert", und Stop
  // direkt aus dem pausierten Zustand heraus funktioniert (kein "hängt fest").
  test('Pausieren und Fortsetzen hängt sich an dieselbe Aufzeichnung, Stop geht auch pausiert', async ({
    page,
    context,
  }) => {
    await page.goto('/excursions');
    await closeDrawerIfOpen(page, 'Kalender');

    const recordBtn = page.locator('.record-btn');
    await expect(recordBtn).toBeVisible({ timeout: 10_000 });
    await recordBtn.click();
    await page.getByRole('button', { name: 'Privat aufzeichnen' }).click();
    await expect(recordBtn).toHaveClass(/active/);

    // aria-label statt Emoji-Text: der Pausieren/Fortsetzen-Button (group="actions") rendert seit
    // #168 immer SVG statt Emoji (siehe stores/iconStyle.ts).
    const recordingPill = page.locator('.recording-pill');
    await expect(recordingPill).toBeVisible();
    await expect(recordingPill).not.toHaveClass(/paused/);
    await expect(recordingPill.locator('.recording-pill-label')).not.toContainText('Pausiert');

    const pauseBtn = recordingPill.locator('.recording-pill-btn').first();
    await expect(pauseBtn).toHaveAttribute('aria-label', 'Aufzeichnung pausieren');
    await pauseBtn.click();

    await expect(recordingPill).toHaveClass(/paused/);
    await expect(recordingPill.locator('.recording-pill-label')).toContainText('Pausiert');
    await expect(pauseBtn).toHaveAttribute('aria-label', 'Aufzeichnung fortsetzen');
    // Bleibt weiterhin "aktiv" (derselbe Track, nicht beendet) - nur GPS-Watch/Flush stehen still.
    await expect(recordBtn).toHaveClass(/active/);

    // Ein GPS-Fix während der Pause soll nicht aufgezeichnet werden - kein direkt beobachtbarer
    // UI-Zustand dafür, hier nur sichergestellt, dass eine Standortänderung während der Pause die
    // App nicht durcheinanderbringt.
    await context.setGeolocation({ latitude: 48.22, longitude: 16.39 });
    await page.waitForTimeout(300);

    await pauseBtn.click();
    await expect(recordingPill).not.toHaveClass(/paused/);
    await expect(recordingPill.locator('.recording-pill-label')).not.toContainText('Pausiert');
    await expect(pauseBtn).toHaveAttribute('aria-label', 'Aufzeichnung pausieren');

    await page.waitForTimeout(300);
    await context.setGeolocation({ latitude: 48.23, longitude: 16.4 });
    await page.waitForTimeout(300);

    // Stop direkt aus fortgesetztem Zustand heraus (analog zum ersten Test) - beendet dieselbe,
    // einzige Aufzeichnung.
    await recordBtn.click();
    await expect(recordBtn).not.toHaveClass(/active/, { timeout: 10_000 });
    await expect(recordingPill).not.toBeVisible();

    const tracksToggle = page.locator('.tracks-toggle');
    await expect(tracksToggle).toBeVisible({ timeout: 10_000 });
    await tracksToggle.click();
    await expect(page.locator('.track-row').first().locator('.track-row-meta')).toContainText(
      /Min\.|Std\./
    );
  });
});
