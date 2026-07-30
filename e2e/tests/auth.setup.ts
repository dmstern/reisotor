import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_PASSWORD, E2E_USERNAME } from '../constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '..', '.auth', 'user.json');
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'),
);

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Benutzername').fill(E2E_USERNAME);
  await page.getByLabel('Passwort').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();

  // Nur sichtbar auf dem echten Dashboard (nicht im Onboarding-Screen von App.vue) — schlägt laut
  // und früh fehl, falls das Demo-Seeding nicht funktioniert hat. .trip-name (Header) statt
  // getByText(...): der Trip-Name kann zusätzlich in der (auf Desktop standardmäßig offenen)
  // Kalender-Schublade als synthetischer "Urlaub-Start/-Ende"-Eintrag auftauchen (strict mode).
  await expect(page.locator('.trip-name', { hasText: seeded.trip.name })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
