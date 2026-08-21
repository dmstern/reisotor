import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionstest für einen vom Nutzer gemeldeten Bug (ursprünglich gegen das inzwischen entfernte
// travel_places-Konzept getestet): ein Reise-Ort, der von mehreren Etappen referenziert wird (z. B.
// "Zuhause" als Startpunkt des Hinflugs UND Zielpunkt des Rückflugs), darf trotzdem nur EINMAL in
// der Spots-Liste erscheinen, nicht einmal pro referenzierender Etappe. Seit der Verschmelzung von
// Reise-Orten in Spots (siehe Migrationskommentar in db/index.ts) ist ein solcher Ort ein ganz
// normaler, in der Spots-Sicht anlegbarer/editierbarer Spot (Kategorie z. B. "Flughafen") statt
// einer separaten, nur lesend abgeleiteten Karte - travel_items referenziert ihn per
// from_place_id/to_place_id, die Spots-Liste selbst kennt nur die Spot-Tabelle und dedupliziert
// dadurch bereits von Natur aus - seit #176 referenziert eine Etappe (Tour mit gesetzter role)
// ihre Von/Nach-Orte per excursion_spots (spot_ids) statt per from_place_id/to_place_id.
test('Ein von mehreren Etappen referenzierter Reise-Ort-Spot erscheint nur einmal in der Spots-Liste', async ({
  page,
}) => {
  const tripId = seeded.trip.id;
  const marker = `E2E-Dedup-Test-${Date.now()}`;
  const homeName = `Zuhause ${marker}`;
  const destinationName = `Zielflughafen ${marker}`;

  const homeSpot = await page.request.post('/api/spots', {
    data: { trip_id: tripId, title: homeName, category: 'Flughafen', is_home: true, lat: 52.52, lng: 13.405 },
  });
  expect(homeSpot.ok()).toBeTruthy();
  const home = await homeSpot.json();

  const destinationSpot = await page.request.post('/api/spots', {
    data: { trip_id: tripId, title: destinationName, category: 'Flughafen', is_home: false, lat: 38.78, lng: -9.14 },
  });
  expect(destinationSpot.ok()).toBeTruthy();
  const destination = await destinationSpot.json();

  // Zwei Etappen (Hin- und Rückflug), die beide dieselben zwei Orte referenzieren - der Bug zeigte
  // sich erst dadurch, dass ein Ort von MEHREREN Etappen aus referenziert wird. Seit #176 ist eine
  // Etappe eine Tour (ideas) mit gesetzter role und genau zwei spot_ids (Von/Nach) statt einer
  // eigenen travel_items-Zeile mit from_place_id/to_place_id.
  const outbound = await page.request.post('/api/ideas', {
    data: { trip_id: tripId, title: `Hinflug ${marker}`, transport_type: 'Flug', role: 'arrival', spot_ids: [home.id, destination.id] },
  });
  expect(outbound.ok()).toBeTruthy();

  const inbound = await page.request.post('/api/ideas', {
    data: { trip_id: tripId, title: `Rückflug ${marker}`, transport_type: 'Flug', role: 'departure', spot_ids: [destination.id, home.id] },
  });
  expect(inbound.ok()).toBeTruthy();

  await page.goto('/excursions');

  // Genau zwei Spots angelegt -> genau zwei Karten, unabhängig davon, dass vier Etappen-Enden
  // (Hinflug Von/Nach, Rückflug Von/Nach) auf sie verweisen.
  const spotCards = page.locator('.spot-card', { hasText: marker });
  await expect(spotCards).toHaveCount(2);

  // Titel = der vom Nutzer vergebene Ortsname, NICHT "Hinflug (Abflug/Abfahrt)"/"Rückflug (Ankunft)".
  await expect(page.locator('.spot-card', { hasText: homeName })).toHaveCount(1);
  await expect(page.locator('.spot-card', { hasText: destinationName })).toHaveCount(1);
  await expect(page.locator('.spot-card', { hasText: `Hinflug ${marker}` })).toHaveCount(0);
  await expect(page.locator('.spot-card', { hasText: `Rückflug ${marker}` })).toHaveCount(0);

  // Icon/Kategorie-Chip der gewählten Kategorie (✈️ Flughafen) statt eines festen Flugzeug-Icons
  // pro Etappe - die Karte zeigt hier ein automatisches Kartenausschnitt-Vorschaubild statt des
  // Kategorie-Platzhalters, da beim Anlegen bereits lat/lng bekannt waren (siehe routes/spots.ts).
  await expect(spotCards.first().locator('.category-chip')).toHaveText('✈️ Flughafen');
  await expect(spotCards.last().locator('.category-chip')).toHaveText('✈️ Flughafen');
});
