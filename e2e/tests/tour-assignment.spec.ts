import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionsnetz für den zentralen Kern-Ablauf von Phase 3 des Spots/Touren-Redesigns (siehe
// CLAUDE.md, "Standardverhalten, nicht Ausnahme"): standardmäßig ordnet man einen Spot per "Tour
// zuordnen"-Combobox (TourAssignPicker.vue) direkt im Spot-Formular einer Tour zu, ganz ohne
// Reihenfolge - erst die "Erweiterte Touren-Bearbeitung"-Einstellung (stores/tourSettings.ts)
// schaltet den Drag&Drop-Reihenfolge-Editor (SpotOrderPicker.vue, inkl. Mehrfachbesuch derselben
// Station) im Touren-Formular frei. Beide Modi teilen sich exakt dasselbe Datenmodell
// (Excursion.spot_ids) - das ist der eigentliche Punkt dieses Tests, kein UI-Detail.
const tripId = seeded.trip.id;

test.describe('Tour-Zuordnung: einfacher Tagging-Modus + Kategorie/Touren-Gruppierung', () => {
  test('Ein neuer Spot lässt sich über "Tour zuordnen" einer neuen Tour zuordnen und erscheint dort beim Gruppieren nach Touren', async ({
    page,
  }) => {
    const marker = `E2E-Tour-Tag-${Date.now()}`;
    const spotTitle = `Café ${marker}`;
    const tourTitle = `Spaziergang ${marker}`;

    await page.goto('/excursions');
    await page.getByRole('button', { name: '+ Neuer Spot' }).click();

    const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
    await modal.locator('input[placeholder="Titel"]').fill(spotTitle);

    // Tour-Titel tippen und über den eigenen "Hinzufügen"-Button des TourAssignPicker (nicht den
    // Formular-Submit, der denselben Text trägt) als Chip übernehmen - ein bislang unbekannter
    // Titel legt beim Speichern eine neue Tour an (siehe ExcursionsView.vue's syncSpotTours()).
    await modal.locator('.tour-add-row input[type="text"]').fill(tourTitle);
    await modal.locator('.tour-add-row button').click();
    await expect(modal.locator('.tour-chip', { hasText: tourTitle })).toBeVisible();

    await modal.locator('form.edit-form button[type="submit"]').click();
    await expect(modal).toBeHidden();

    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await expect(spotCard).toBeVisible();

    // Umschalten auf Touren-Gruppierung: der neu erstellte Spot muss unter der neu erstellten Tour
    // auftauchen, statt (wie im Kategorie-Modus) unter seiner Kategorie.
    await page.getByRole('button', { name: '🎒 Touren' }).click();
    const tourGroupHeading = page.locator('.category-heading', { hasText: tourTitle });
    await expect(tourGroupHeading).toBeVisible();
    await expect(spotCard).toBeVisible();

    await page.getByRole('button', { name: '🏷️ Kategorie' }).click();
  });
});

test.describe('Erweiterte Touren-Bearbeitung: geteiltes Datenmodell zwischen einfachem und Power-User-Modus', () => {
  test('Reihenfolge + Mehrfachbesuch bleiben erhalten, wenn zwischen den beiden Bearbeitungsmodi gewechselt wird', async ({
    page,
  }) => {
    const marker = `E2E-Tour-Order-${Date.now()}`;
    const spotATitle = `Marktplatz ${marker}`;
    const spotBTitle = `Aussichtspunkt ${marker}`;
    const tourTitle = `Rundgang ${marker}`;

    const spotA = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotATitle, category: 'Sehenswürdigkeit' },
    });
    expect(spotA.ok()).toBeTruthy();
    const spotB = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotBTitle, category: 'Sehenswürdigkeit' },
    });
    expect(spotB.ok()).toBeTruthy();

    // Power-User-Einstellung aktivieren.
    await page.goto('/profile');
    const advancedCheckbox = page.locator('label', { hasText: 'Erweiterte Touren-Bearbeitung' }).locator('input');
    await advancedCheckbox.check();
    await expect(advancedCheckbox).toBeChecked();

    await page.goto('/tours');
    await page.getByRole('button', { name: '+ Neue Tour' }).click();
    const newTourModal = page.locator('.modal', { hasText: 'Neue Tour' });
    await newTourModal.locator('input[placeholder="Titel"]').fill(tourTitle);

    // Der Reihenfolge-Editor (statt des einfachen Umschalt-Pickers) ist jetzt sichtbar - Start UND
    // Ende an derselben Station (Spot A), dazwischen Spot B: Klick fügt IMMER eine weitere Station
    // hinzu (kein Checkbox-Verhalten), genau das ist der Kern des Power-User-Modus.
    await expect(newTourModal.locator('.spot-toggle-picker')).toHaveCount(0);
    const addableRow = (title: string) => newTourModal.locator('.spot-picker .derived-option', { hasText: title });
    await addableRow(spotATitle).click();
    await addableRow(spotBTitle).click();
    await addableRow(spotATitle).click();

    const plannedTitles = newTourModal.locator('.planned-row .spot-title');
    await expect(plannedTitles).toHaveText([
      new RegExp(spotATitle),
      new RegExp(spotBTitle),
      new RegExp(spotATitle),
    ]);

    await newTourModal.locator('form.edit-form button[type="submit"]').click();
    await expect(newTourModal).toBeHidden();

    // Neu laden + erneut bearbeiten: Reihenfolge und Mehrfachbesuch müssen einen vollen
    // Save+Reload-Zyklus überstehen (nicht nur clientseitig im Formular-State vorhanden sein).
    await page.reload();
    const tourCard = page.locator('.excursion-card', { hasText: tourTitle });
    await tourCard.getByRole('button', { name: 'Bearbeiten' }).click();
    const editModal = page.locator('.modal', { hasText: 'Tour bearbeiten' });
    await expect(editModal.locator('.planned-row .spot-title')).toHaveText([
      new RegExp(spotATitle),
      new RegExp(spotBTitle),
      new RegExp(spotATitle),
    ]);
    await editModal.locator('.close-btn').click();

    // Power-User-Einstellung wieder deaktivieren: dieselbe Tour muss im einfachen Modus weiterhin
    // öffnen (keine Datenverlust/Absturz), auch wenn Reihenfolge/Mehrfachbesuch dort nicht mehr
    // separat dargestellt werden - beide Modi teilen sich exakt dasselbe spot_ids-Feld.
    await page.goto('/profile');
    await advancedCheckbox.uncheck();
    await expect(advancedCheckbox).not.toBeChecked();

    await page.goto('/tours');
    const tourCardAgain = page.locator('.excursion-card', { hasText: tourTitle });
    await tourCardAgain.getByRole('button', { name: 'Bearbeiten' }).click();
    const simpleEditModal = page.locator('.modal', { hasText: 'Tour bearbeiten' });
    await expect(simpleEditModal.locator('.spot-toggle-picker')).toBeVisible();
    await expect(simpleEditModal.locator('.spot-toggle-row', { hasText: spotATitle }).locator('input')).toBeChecked();
    await expect(simpleEditModal.locator('.spot-toggle-row', { hasText: spotBTitle }).locator('input')).toBeChecked();
  });
});
