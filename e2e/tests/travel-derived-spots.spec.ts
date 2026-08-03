import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionstest für einen vom Nutzer gemeldeten Bug: Hin- und Rückflug teilen sich denselben
// zugrunde liegenden Ort (z. B. "Zuhause" ist Startpunkt des Hinflugs UND Zielpunkt des Rückflugs,
// der Zielflughafen ist Ziel des Hinflugs UND Start des Rückflugs, siehe TravelPlace/from_place_id/
// to_place_id) - jede Etappen-Seite wurde bisher unabhängig in einen eigenen Karten-/Listeneintrag
// übersetzt, ohne zu prüfen, ob eine ANDERE Etappen-Seite bereits denselben Ort abbildet. Derselbe
// physische Ort erschien dadurch zweimal in der Spots-Liste. Fix: utils/travelDerivedLocations.ts
// dedupliziert jetzt über from_place_id/to_place_id. Gleichzeitig wurde das feste Flugzeug-Icon
// (🛫/🛬) durch das tatsächliche Transportmittel-Icon des Reise-Eintrags ersetzt (travelTypeIcon()).
test('Reise-Orte (Hin-/Rückflug an denselben Plätzen) erscheinen nur einmal in der Spots-Liste, mit dem Transportmittel-Icon', async ({
  page,
}) => {
  const tripId = seeded.trip.id;
  const marker = `E2E-Dedup-Test-${Date.now()}`;

  const homePlace = await page.request.post('/api/travel/places', {
    data: { trip_id: tripId, name: `Zuhause ${marker}`, is_home: true, lat: 52.52, lng: 13.405 },
  });
  expect(homePlace.ok()).toBeTruthy();
  const home = await homePlace.json();

  const destinationPlace = await page.request.post('/api/travel/places', {
    data: { trip_id: tripId, name: `Zielflughafen ${marker}`, is_home: false, lat: 38.78, lng: -9.14 },
  });
  expect(destinationPlace.ok()).toBeTruthy();
  const destination = await destinationPlace.json();

  const outbound = await page.request.post('/api/travel', {
    data: {
      trip_id: tripId,
      title: `Hinflug ${marker}`,
      type: 'Flug',
      from_place_id: home.id,
      to_place_id: destination.id,
    },
  });
  expect(outbound.ok()).toBeTruthy();

  const inbound = await page.request.post('/api/travel', {
    data: {
      trip_id: tripId,
      title: `Rückflug ${marker}`,
      type: 'Flug',
      from_place_id: destination.id,
      to_place_id: home.id,
    },
  });
  expect(inbound.ok()).toBeTruthy();

  await page.goto('/excursions');

  // Zwei zugrunde liegende Orte (Zuhause + Zielflughafen), obwohl vier Etappen-Enden (Hinflug
  // Von/Nach, Rückflug Von/Nach) existieren - ohne Dedup wären es vier Karten statt zwei.
  const derivedCards = page.locator('.derived-card', { hasText: marker });
  await expect(derivedCards).toHaveCount(2);

  // Transportmittel-Icon (✈️ für "Flug") statt des bisherigen festen Flugzeug-Icons (🛫/🛬), das
  // unabhängig vom tatsächlichen Transportmittel jedes Etappen-Ende zeigte.
  await expect(derivedCards.first().locator('.placeholder')).toHaveText('✈️');
  await expect(derivedCards.last().locator('.placeholder')).toHaveText('✈️');
});
