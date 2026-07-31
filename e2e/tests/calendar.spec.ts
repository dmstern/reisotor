import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'),
);
const dinner = seeded.scheduleItems.find((i: { title: string }) => i.title === 'Abendessen im Time Out Market');
const belemDay = seeded.scheduleItems.find((i: { title: string }) => i.title === 'Torre de Belém besichtigen');
const excursion = seeded.ideas.find((i: { title: string }) => i.title === 'Sightseeing-Tag Belém');

test.beforeEach(async ({ page }) => {
  // Die Kalender-Schublade ist auf Desktop-Viewports (>= 800px, siehe stores/drawers.ts
  // isDesktop()) standardmäßig bereits offen — kein Klick auf die Dashboard-Kachel nötig.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kalender', exact: true, level: 2 })).toBeVisible();
});

test('day selection shows the seeded schedule entry for that day', async ({ page }) => {
  await page.locator(`.day[data-date="${dinner.date}"]`).click();
  await expect(page.locator('.day-detail .items .item')).toContainText(dinner.title);
});

test('clicking an own schedule entry opens the detail dialog instead of navigating', async ({ page }) => {
  await page.locator(`.day[data-date="${dinner.date}"]`).click();
  await page.locator('.item', { hasText: dinner.title }).click();

  // Card-Klick statt separatem "Bearbeiten"/Nav-Button (siehe ScheduleView.vue openEntry()) —
  // darf nicht navigieren, das Drawer/die Seite bleiben unverändert.
  await expect(page).toHaveURL(/\/$/);

  const modal = page.locator('.overlay .modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Zeit')).toBeVisible();
  await expect(modal).toContainText(dinner.time);
  await expect(modal.getByText('Ort')).toBeVisible();
  await expect(modal).toContainText(dinner.location);
  await expect(modal.locator('button[aria-label="Bearbeiten"]')).toBeVisible();
  await expect(modal.locator('button[aria-label="Löschen"]')).toBeVisible();

  // Regression: die Detail-Felder (.detail-row, Zeit/Ort-Labels) duerfen nur im Modal auftauchen,
  // nicht in der Tagesliste selbst (die zeigt nur .title/.location/.note, siehe ScheduleView.vue).
  await expect(page.locator('.day-detail .detail-row')).toHaveCount(0);
});

test('clicking a tour-linked calendar entry opens the detail dialog, not the excursions drawer', async ({ page }) => {
  await page.locator(`.day[data-date="${belemDay.date}"]`).click();
  await page.locator('.item', { hasText: excursion.title }).click();

  // Ein mit einer Tour verknüpfter Termin ist ein ganz normaler, editierbarer Kalender-Termin
  // (siehe ScheduleView.vue openEntry()) – Klick öffnet den Anzeige-Dialog statt zur
  // Touren-Schublade zu springen, mit einer Zeile zur verknüpften Tour.
  await expect(page).toHaveURL(/\/$/);
  const modal = page.locator('.overlay .modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Verknüpft')).toBeVisible();
  await expect(modal).toContainText(excursion.title);
  await expect(modal.locator('button[aria-label="Bearbeiten"]')).toBeVisible();
});

test('MapsAppPicker dropdown is not clipped by the modal', async ({ page }) => {
  // Keiner der seedDemo.ts-Termine hat lat/lng — daher hier bewusst über die UI einen neuen
  // Termin mit Maps-Link anlegen (statt Seed-Daten anzufassen), um den MapsAppPicker im
  // Detail-Dialog zu triggern.
  const day = seeded.trip.start_date;
  await page.locator(`.day[data-date="${day}"]`).click();
  await page.getByRole('button', { name: '+ Neu', exact: true }).click();
  await page.getByPlaceholder('Titel').fill('MapsAppPicker Regressionstest');
  await page.getByPlaceholder('Ort (optional)').fill('Torre de Belém');
  await page.getByPlaceholder('Maps-Link (Google/Apple) (optional)').fill('https://www.google.com/maps/@38.6916,-9.2159,17z');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

  await page.locator('.item', { hasText: 'MapsAppPicker Regressionstest' }).click();
  await page.getByRole('button', { name: 'In Karten-App öffnen' }).click();

  // Playwrights toBeVisible() berücksichtigt overflow-Clipping durch Vorfahren-Elemente — genau
  // das war der ursprüngliche Bug (Menü unsichtbar im overflow-y:auto des Modals).
  const appleMaps = page.getByRole('link', { name: 'Apple Maps' });
  const googleMaps = page.getByRole('link', { name: 'Google Maps' });
  await expect(appleMaps).toBeVisible();
  await expect(googleMaps).toBeVisible();

  const menuBox = await page.locator('.picker-menu').boundingBox();
  const viewport = page.viewportSize();
  expect(menuBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (menuBox && viewport) {
    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
  }
});
