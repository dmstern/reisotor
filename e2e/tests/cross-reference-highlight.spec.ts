import { test, expect } from '@playwright/test';
import { expectWithinViewport } from './helpers/layout';

// Regressionsnetz für den generalisierten Sprung-und-Hervorhebungs-Mechanismus (siehe
// utils/hashHighlight.ts): ein Querverweis-Klick soll nicht nur die Ziel-Ansicht öffnen, sondern
// auch zum referenzierten Element scrollen und es farblich hervorheben (new-highlight-Klasse) –
// hier am Beispiel des Kalender-Klicks auf einen mit Datum versehenen Reise-Eintrag
// (ScheduleView.vue's openEntry(), Ziel: /travel#travel-<id>).
test('clicking a travel entry in the calendar jumps to and highlights the matching travel card', async ({
  page,
}) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  await page.goto('/travel');
  await page.getByRole('button', { name: '+ Neue Fahrt/Flug', exact: true }).click();
  await page.getByPlaceholder('z. B. Hinflug nach Wien').fill('E2E Cross-Reference-Test-Flug');
  await page.locator('.modal input[type="date"]').first().fill(todayIso);
  await page.locator('.modal button[type="submit"]', { hasText: 'Hinzufügen' }).click();
  await expect(page.locator('.travel-card', { hasText: 'E2E Cross-Reference-Test-Flug' })).toBeVisible();

  await page.goto('/');
  await page.locator(`.day[data-date="${todayIso}"]`).click();
  await page.locator('.day-detail .items .item', { hasText: 'E2E Cross-Reference-Test-Flug' }).click();

  await expect(page).toHaveURL(new RegExp(`/travel#travel-\\d+$`));
  const travelCard = page.locator('.travel-card', { hasText: 'E2E Cross-Reference-Test-Flug' });
  await expect(travelCard).toBeVisible();
  await expect(travelCard).toHaveClass(/new-highlight/);
  await expectWithinViewport(page, travelCard);
});
