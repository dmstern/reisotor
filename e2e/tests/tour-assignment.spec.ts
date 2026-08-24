import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionsnetz für den zentralen Kern-Ablauf des Spots/Touren-Redesigns (siehe CLAUDE.md,
// "Standardverhalten, nicht Ausnahme"): man kann einen Spot entweder per "Tour zuordnen"-Combobox
// (TourAssignPicker.vue) direkt im Spot-Formular ohne Reihenfolge einer Tour zuordnen, oder über
// den Drag&Drop-Reihenfolge-Editor (SpotOrderPicker.vue, inkl. Mehrfachbesuch derselben Station) im
// Touren-Formular - beide Wege schreiben in dasselbe Excursion.spot_ids-Feld, das ist der
// eigentliche Punkt dieses Tests, kein UI-Detail. Seit dem Zurückbau des früheren "erweiterten
// Touren-Modus" ist der Reihenfolge-Editor immer verfügbar, direkt in der Karte-Hauptsicht
// (ExcursionsView.vue) statt in einer eigenständigen Touren-Schublade/-Route.
const tripId = seeded.trip.id;

test.describe('Tour-Zuordnung: einfacher Tagging-Modus + Kategorie/Touren-Gruppierung', () => {
  test('Ein neuer Spot lässt sich über "Tour zuordnen" einer neuen Tour zuordnen und erscheint dort beim Gruppieren nach Touren', async ({
    page,
  }) => {
    const marker = `E2E-Tour-Tag-${Date.now()}`;
    const spotTitle = `Café ${marker}`;
    const tourTitle = `Spaziergang ${marker}`;

    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Neuer Spot' }).click();

    const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
    await modal.locator('input[placeholder="Titel"]').fill(spotTitle);

    await modal.locator('.collapsible-toggle', { hasText: 'Touren zuordnen' }).click();

    // Tour-Titel tippen und per Enter (#207: eigener "Hinzufügen"-Button des TourAssignPicker
    // entfernt, klebte als Listeneintrag zu eng am Formular-Submit-Button gleichen Namens) als Chip
    // übernehmen - ein bislang unbekannter Titel legt beim Speichern eine neue Tour an (siehe
    // ExcursionsView.vue's syncSpotTours()).
    const tourInput = modal.locator('.tour-assign-picker input[type="text"]');
    await tourInput.fill(tourTitle);
    await tourInput.press('Enter');
    await expect(modal.locator('.tour-chip', { hasText: tourTitle })).toBeVisible();

    await modal.locator('form.edit-form button[type="submit"]').click();
    await expect(modal).toBeHidden();

    const spotCard = page.locator('.spot-card', { hasText: spotTitle });
    await expect(spotCard).toBeVisible();

    // Umschalten auf Touren-Gruppierung: der neu erstellte Spot muss unter der neu erstellten Tour
    // auftauchen, statt (wie im Kategorie-Modus) unter seiner Kategorie. Die Gruppen-Überschrift ist
    // dabei eine anklickbare ExcursionCard (.excursion-card) statt einer reinen Text-Überschrift
    // (die bleibt nur der Sammelgruppe "Ohne Tour" vorbehalten, siehe ExcursionsView.vue).
    await page.getByRole('button', { name: 'Touren' }).click();
    const tourGroupCard = page.locator('.excursion-card', { hasText: tourTitle });
    await expect(tourGroupCard).toBeVisible();
    await expect(spotCard).toBeVisible();

    await page.getByRole('button', { name: 'Spots', exact: true }).click();
  });

  test('Durch den Kategorie-Filter ausgeblendete Tour-Spots zeigen einen eigenen Hinweis statt "keine Spots zugeordnet"', async ({
    page,
  }) => {
    const marker = `E2E-Tour-Filter-${Date.now()}`;
    const spotTitle = `Aussichtspunkt ${marker}`;
    const tourTitle = `Stadtrundgang ${marker}`;

    const spotRes = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotTitle, category: 'Sehenswürdigkeit' },
    });
    expect(spotRes.ok()).toBeTruthy();
    const spot = await spotRes.json();
    const tourRes = await page.request.post('/api/ideas', {
      data: { trip_id: tripId, title: tourTitle, spot_ids: [spot.id] },
    });
    expect(tourRes.ok()).toBeTruthy();

    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Touren' }).click();
    const group = page.locator('.category-group', { hasText: tourTitle });
    await expect(group.locator('.spot-card', { hasText: spotTitle })).toBeVisible();
    await expect(group.locator('.empty')).toHaveCount(0);

    // Kategorie-Filter setzen, der den zugeordneten Spot (Sehenswürdigkeit) ausschließt - die Tour
    // hat weiterhin einen zugeordneten Spot, er ist nur gerade nicht sichtbar.
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    await page.getByRole('checkbox', { name: 'Restaurant' }).first().check();
    await page.locator('.picker-backdrop').click();

    await expect(group.locator('.spot-card', { hasText: spotTitle })).toHaveCount(0);
    await expect(group.locator('.empty')).toContainText('durch den Kategorie-/Status-Filter ausgeblendet');
    await expect(group.locator('.empty')).not.toContainText('Noch keine Spots zugeordnet');

    // Filter zurücksetzen: der Hinweis verschwindet wieder, der Spot ist erneut sichtbar.
    await page.getByRole('button', { name: 'Nach Kategorie filtern' }).click();
    await page.getByRole('checkbox', { name: 'Restaurant' }).first().uncheck();
    await page.locator('.picker-backdrop').click();
    await expect(group.locator('.spot-card', { hasText: spotTitle })).toBeVisible();
    await expect(group.locator('.empty')).toHaveCount(0);

    await page.getByRole('button', { name: 'Spots', exact: true }).click();
  });
});

test.describe('Touren-Reihenfolge-Editor: Reihenfolge + Mehrfachbesuch direkt in der Karte-Hauptsicht', () => {
  test('Reihenfolge + Mehrfachbesuch bleiben nach Speichern+Neuladen erhalten, Tour-Karte visualisiert die Tour auf der Karte', async ({
    page,
  }) => {
    const marker = `E2E-Tour-Order-${Date.now()}`;
    const spotATitle = `Marktplatz ${marker}`;
    const spotBTitle = `Aussichtspunkt ${marker}`;
    const tourTitle = `Rundgang ${marker}`;

    // Mit Koordinaten angelegt (nicht nur Titel/Kategorie): ExcursionCard.vue zeigt den
    // "🗺️ Auf Karte anzeigen"-Button nur, wenn mindestens eine Station einen Standort hat.
    const spotA = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotATitle, category: 'Sehenswürdigkeit', lat: 38.7223, lng: -9.1393 },
    });
    expect(spotA.ok()).toBeTruthy();
    const spotB = await page.request.post('/api/spots', {
      data: { trip_id: tripId, title: spotBTitle, category: 'Sehenswürdigkeit', lat: 38.7169, lng: -9.1399 },
    });
    expect(spotB.ok()).toBeTruthy();

    await page.goto('/excursions');
    // #155: "+ Neue Tour" wird nur noch bei aktiver Touren-Gruppierung angezeigt (statt wie zuvor
    // immer neben "+ Neuer Spot") - erst umschalten, falls eine vorherige Spec im geteilten
    // localStorage-Zustand die Kategorie-Gruppierung hinterlassen hat.
    await page.locator('.header h2').getByRole('button', { name: 'Touren' }).click();
    await page.getByRole('button', { name: 'Neue Tour' }).click();
    const newTourModal = page.locator('.modal', { hasText: 'Neue Tour' });
    await newTourModal.locator('input[placeholder="Titel"]').fill(tourTitle);

    await newTourModal.locator('.collapsible-toggle', { hasText: 'Spots zuordnen' }).click();

    // Start UND Ende an derselben Station (Spot A), dazwischen Spot B: Klick fügt IMMER eine
    // weitere Station hinzu (kein Checkbox-Verhalten) - der Reihenfolge-Editor ist seit dem
    // Zurückbau des früheren "erweiterten Touren-Modus" immer verfügbar, kein Umschalten mehr nötig.
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

    // Bereits seit dem Umschalten oben in Touren-Gruppierung (Standard wäre Kategorien, dort taucht
    // die neue Tour noch nicht als eigene Karte auf - erst die Touren-Gruppierung zeigt sie als
    // anklickbare ExcursionCard).

    // Neu laden + erneut bearbeiten: Reihenfolge und Mehrfachbesuch müssen einen vollen
    // Save+Reload-Zyklus überstehen (nicht nur clientseitig im Formular-State vorhanden sein).
    await page.reload();
    await page.getByRole('button', { name: 'Touren' }).click();
    const tourCard = page.locator('.excursion-card', { hasText: tourTitle });
    await expect(tourCard).toBeVisible();

    // Klick auf die Tour-Karte visualisiert die Tour auf der Karte (kein extra Touren-View nötig).
    await tourCard.locator('.card-action-btn', { hasText: 'Auf Karte anzeigen' }).click();
    await expect(page.locator('.focus-banner', { hasText: tourTitle })).toBeVisible();

    // Bearbeiten-/Löschen-Buttons sind erst in der aufgeklappten Karte sichtbar (#143, analog zu
    // SpotCard.vue) - Klick auf den Titel klappt sie auf, bevor der Button erreichbar ist.
    await tourCard.locator('h3').click();
    await expect(tourCard).toHaveClass(/expanded/);
    await tourCard.getByRole('button', { name: 'Bearbeiten' }).click();
    const editModal = page.locator('.modal', { hasText: 'Tour bearbeiten' });
    await editModal.locator('.collapsible-toggle', { hasText: 'Spots zuordnen' }).click();
    await expect(editModal.locator('.planned-row .spot-title')).toHaveText([
      new RegExp(spotATitle),
      new RegExp(spotBTitle),
      new RegExp(spotATitle),
    ]);
  });
});
