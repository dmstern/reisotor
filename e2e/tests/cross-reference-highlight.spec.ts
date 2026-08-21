import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionsnetz für den generalisierten Sprung-und-Hervorhebungs-Mechanismus (siehe
// utils/hashHighlight.ts): ein Querverweis-Klick soll nicht nur die Ziel-Ansicht öffnen, sondern
// auch zum referenzierten Element scrollen und es farblich hervorheben (new-highlight-Klasse) –
// hier am Beispiel des Kalender-Klicks auf einen mit Datum versehenen Reise-Eintrag
// (ScheduleView.vue's openEntry(), Ziel seit #176: /excursions?group=travel#travel-<id> - eine
// role-getaggte Tour statt der früheren eigenen travel_items-Zeile, siehe Migrationskommentar in
// db/index.ts). Die Tour selbst wird per API angelegt (zwei Spots + Idea mit role), da das
// Von/Nach-Formular seit #176 bestehende Spots per <select> statt Freitext erwartet.
test('clicking a travel entry in the calendar jumps to and highlights the matching travel card', async ({
  page,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const marker = `E2E-Cross-Ref-${Date.now()}`;
  const title = `Cross-Reference-Test-Flug ${marker}`;

  const tripId = seeded.trip.id;

  const homeSpot = await page.request.post('/api/spots', {
    data: { trip_id: tripId, title: `Zuhause ${marker}`, category: 'Zuhause' },
  });
  expect(homeSpot.ok()).toBeTruthy();
  const home = await homeSpot.json();

  const destinationSpot = await page.request.post('/api/spots', {
    data: { trip_id: tripId, title: `Zielflughafen ${marker}`, category: 'Flughafen' },
  });
  expect(destinationSpot.ok()).toBeTruthy();
  const destination = await destinationSpot.json();

  const idea = await page.request.post('/api/ideas', {
    data: {
      trip_id: tripId,
      title,
      date: todayIso,
      spot_ids: [home.id, destination.id],
      role: 'departure',
      transport_type: 'Flug',
    },
  });
  expect(idea.ok()).toBeTruthy();

  await page.goto('/');
  await page.locator(`.day[data-date="${todayIso}"]`).click();
  await page.locator('.day-detail .items .item', { hasText: title }).click();

  await expect(page).toHaveURL(new RegExp(`/excursions\\?group=travel#travel-\\d+$`));
  const travelCard = page.locator('.excursion-card', { hasText: title });
  await expect(travelCard).toBeVisible();
  await expect(travelCard).toHaveClass(/new-highlight/);
  // Playwright-eigenes toBeInViewport() statt der strikten Vollständig-eingeschlossen-Prüfung aus
  // helpers/layout.ts (die für Überlappungs-/Verdeckungs-Tests gedacht ist): Desktop hat parallel
  // die globale Kalender-Schublade offen (App.vue), die dem Excursions-Inhalt Höhe wegnimmt - der
  // Router scrollt trotzdem zuverlässig bis das Ziel mindestens teilweise sichtbar ist.
  await expect(travelCard).toBeInViewport();
});
