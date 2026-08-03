import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionstest für einen vom Nutzer gemeldeten Bug: die Spots-Liste zeigte für jeden angelegten
// Reise-Ort (TravelView.vue's "Orte"-Karte, travel_places) einen eigenen Eintrag PRO ETAPPEN-ENDE,
// das ihn referenziert - Hin- und Rückflug teilen sich aber typischerweise denselben Ort ("Zuhause"
// ist Startpunkt des Hinflugs UND Zielpunkt des Rückflugs), wodurch der Nutzer denselben Ort
// zweimal in der Liste sah, betitelt mit "Hinflug (Abflug/Abfahrt)"/"Rückflug (Ankunft)" statt dem
// von ihm selbst vergebenen Ortsnamen. Fix: utils/travelDerivedLocations.ts leitet Spots-Einträge
// jetzt direkt aus travel_places ab (ein Eintrag PRO ORT, unabhängig davon, wie viele Etappen ihn
// referenzieren), mit dem Ortsnamen als Titel und dem Icon der gewählten Ort-Art
// (utils/travelPlaceType.ts) statt eines festen Flugzeug-Icons.
test('Angelegte Reise-Orte erscheinen mit ihrem eigenen Namen/Icon in der Spots-Liste - nicht dupliziert pro Etappe', async ({
  page,
}) => {
  const tripId = seeded.trip.id;
  const marker = `E2E-Dedup-Test-${Date.now()}`;
  const homeName = `Zuhause ${marker}`;
  const destinationName = `Zielflughafen ${marker}`;

  const homePlace = await page.request.post('/api/travel/places', {
    data: { trip_id: tripId, name: homeName, is_home: true, type: 'Flughafen', lat: 52.52, lng: 13.405 },
  });
  expect(homePlace.ok()).toBeTruthy();
  const home = await homePlace.json();

  const destinationPlace = await page.request.post('/api/travel/places', {
    data: { trip_id: tripId, name: destinationName, is_home: false, type: 'Flughafen', lat: 38.78, lng: -9.14 },
  });
  expect(destinationPlace.ok()).toBeTruthy();
  const destination = await destinationPlace.json();

  // Zwei Etappen (Hin- und Rückflug), die beide dieselben zwei Orte referenzieren - der Bug zeigte
  // sich erst dadurch, dass ein Ort von MEHREREN Etappen aus referenziert wird.
  const outbound = await page.request.post('/api/travel', {
    data: { trip_id: tripId, title: `Hinflug ${marker}`, type: 'Flug', from_place_id: home.id, to_place_id: destination.id },
  });
  expect(outbound.ok()).toBeTruthy();

  const inbound = await page.request.post('/api/travel', {
    data: { trip_id: tripId, title: `Rückflug ${marker}`, type: 'Flug', from_place_id: destination.id, to_place_id: home.id },
  });
  expect(inbound.ok()).toBeTruthy();

  await page.goto('/excursions');

  // Genau zwei Orte angelegt -> genau zwei Karten, unabhängig davon, dass vier Etappen-Enden
  // (Hinflug Von/Nach, Rückflug Von/Nach) auf sie verweisen.
  const derivedCards = page.locator('.derived-card', { hasText: marker });
  await expect(derivedCards).toHaveCount(2);

  // Titel = der vom Nutzer vergebene Ortsname, NICHT "Hinflug (Abflug/Abfahrt)"/"Rückflug (Ankunft)".
  await expect(page.locator('.derived-card', { hasText: homeName })).toHaveCount(1);
  await expect(page.locator('.derived-card', { hasText: destinationName })).toHaveCount(1);
  await expect(page.locator('.derived-card', { hasText: `Hinflug ${marker}` })).toHaveCount(0);
  await expect(page.locator('.derived-card', { hasText: `Rückflug ${marker}` })).toHaveCount(0);

  // Icon der gewählten Ort-Art (✈️ für "Flughafen") statt eines festen Flugzeug-Icons pro Etappe.
  await expect(derivedCards.first().locator('.placeholder')).toHaveText('✈️');
  await expect(derivedCards.last().locator('.placeholder')).toHaveText('✈️');
});
