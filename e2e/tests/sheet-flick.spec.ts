import { test, expect } from '@playwright/test';
import { VIEWPORTS } from './helpers/layout';

// Regressionstest für einen real gemeldeten Bug (Nutzer-Feedback per Video-Vergleich mit Google
// Maps): das mobile Spots-Bottom-Sheet (ExcursionsView.vue) reagierte bei einem kurzen, schnellen
// Wisch (Flick) auf den Anfasser nicht wie erwartet mit einem Wechsel in den nächsten Zustand,
// sondern "poppte" beim Loslassen zurück auf den Ausgangszustand - closestSheetState() entschied
// bisher ausschließlich nach der End-Position (nächster von drei Höhen-Zuständen), eine kurze
// Wisch-Distanz landete dadurch fast immer wieder beim Start. Fix: resolveSheetTargetState() im
// Script erkennt jetzt zusätzlich die Zieh-Geschwindigkeit (dragFlickVelocity()) und schaltet bei
// einem knackigen Flick unabhängig von der Distanz einen Zustand weiter - wie bei Google Maps.
test.describe('Mobile Spots-Sheet: knackiger Flick schaltet einen Zustand weiter statt zurückzupoppen', () => {
  test.use({ viewport: VIEWPORTS.mobile });

  test('kurzer, schneller Wisch nach oben am Anfasser wechselt von "angeschnitten" auf "voll"', async ({
    page,
  }) => {
    await page.goto('/excursions');
    const sheet = page.locator('.spots-col');
    await expect(sheet).toBeVisible();
    await expect(sheet).not.toHaveClass(/full/);
    await expect(sheet).not.toHaveClass(/collapsed/);

    const handle = page.locator('.sheet-handle');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('sheet-handle nicht sichtbar');
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    // Kurze Distanz (30px, deutlich weniger als die Hälfte des Abstands zwischen "angeschnitten"
    // und "voll") in einem einzigen Sprung (kein steps-Interpolieren) - jeder zusätzliche
    // page.mouse.move()-Aufruf ist ein eigener CDP-Roundtrip, ein einzelner Sprung hält die
    // gemessene Zieh-Dauer (und damit die Geschwindigkeit) realistisch hoch, wie bei einem echten
    // Flick. Reine Positions-Logik (closestSheetState) würde bei 30px beim Ausgangszustand bleiben,
    // nur die Geschwindigkeits-Erkennung (dragFlickVelocity) schaltet trotzdem weiter.
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY - 30);
    await page.mouse.up();

    await expect(sheet).toHaveClass(/full/);
  });

  test('kurzer, schneller Wisch nach unten am Anfasser wechselt von "voll" auf "angeschnitten"', async ({
    page,
  }) => {
    await page.goto('/excursions');
    const sheet = page.locator('.spots-col');
    await expect(sheet).toBeVisible();

    // Erst per Stufen-Button auf "voll" bringen (deterministischer Ausgangspunkt als ein zweiter Flick).
    await page.getByRole('button', { name: 'Spots-Liste weiter hochschieben' }).click();
    await expect(sheet).toHaveClass(/full/);
    // Die Höhen-Transition (0.3s) muss erst abgeschlossen sein, bevor die Anfasser-Position unten
    // gemessen wird - sonst greift boundingBox() eine noch mitten in der Animation befindliche
    // (und damit gleich wieder überholte) Zwischenposition ab.
    await page.waitForTimeout(400);

    const handle = page.locator('.sheet-handle');
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('sheet-handle nicht sichtbar');
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 30);
    await page.mouse.up();

    await expect(sheet).not.toHaveClass(/full/);
    await expect(sheet).not.toHaveClass(/collapsed/);
  });
});
