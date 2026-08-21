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

  // Fixiert Emoji als Icon-Darstellung für die gesamte Suite (geteiltes storageState, siehe
  // playwright.config.ts) - viele bestehende Tests identifizieren ein Icon beiläufig per festem
  // Emoji-Zeichen (z. B. '📋', '⏱️'), ohne dass es dabei eigentlich um die Icon-Stil-Einstellung
  // selbst geht. stores/iconStyle.ts's Default ist seit Issue #74 überall Symbole außer Kategorien -
  // ohne diesen Fixpunkt würden diese Assertions bei jeder künftigen Default-Änderung erneut
  // brechen. Nur tests/icon-style.spec.ts (testet die Einstellung selbst) überschreibt das gezielt.
  // Seit #105 kontoweit über die API persistiert statt in localStorage (siehe stores/iconStyle.ts) -
  // page.request teilt sich die Session-Cookies mit page, der PUT läuft also bereits authentifiziert.
  // 'formFields'/'actions' sind seit #168 nicht mehr konfigurierbar (immer Symbole) und tauchen
  // deshalb hier nicht mehr auf - Tests dürfen dort also nicht mehr per Emoji-Zeichen identifizieren.
  await page.request.put('/api/users/me/icon-settings', {
    data: {
      settings: {
        groups: { navigation: 'emoji', categories: 'emoji', weather: 'emoji' },
      },
    },
  });

  await page.context().storageState({ path: authFile });
});
