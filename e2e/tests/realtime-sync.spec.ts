import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_PASSWORD, E2E_PASSWORD_2, E2E_USERNAME, E2E_USERNAME_2 } from '../constants.js';
import { newContextWithReducedMotion } from './helpers/context';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8'));

// Regressionsnetz für den Echtzeit-Sync zwischen Mitgliedern (siehe stores/liveSync.ts,
// backend/src/activity.ts/routes/realtime.ts): wenn ein Mitglied etwas ändert, sollen die übrigen
// verbundenen Mitglieder eines Urlaubs das ohne manuelles Neuladen sehen (Nav-Punkt + Refetch), der
// Punkt soll beim Besuch der betroffenen Ansicht wieder verschwinden.
//
// Zwei unabhängige Browser-Kontexte statt des "chromium"-Projekt-Storage-States: dessen
// storageState:authFile gilt als Default für JEDEN browser.newContext()-Aufruf innerhalb des
// Projekts, auch hier – ohne ausdrücklich leeren Storage-State würden beide Kontexte als dieselbe
// bereits eingeloggte e2e-user1-Session starten statt als zwei unabhängige Sessions.
test('another member creating a todo lights up the ToDo nav badge, which clears and highlights on visit', async ({
  browser,
}) => {
  const ctxA = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const ctxB = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  async function login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(username);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('.trip-name').first()).toBeVisible();
  }

  await login(pageA, E2E_USERNAME, E2E_PASSWORD);
  await login(pageB, E2E_USERNAME_2, E2E_PASSWORD_2);

  // ToDo hat seit dem "Listen"-Merge keinen eigenen Nav-Link mehr (siehe ListenView.vue/NavBar.vue)
  // - der Ungelesen-Punkt lebt jetzt am gemeinsamen "Listen"-Eintrag, leuchtet aber weiterhin für
  // ToDo-Aktivität (hasUnseenAny() prüft alle drei zusammengelegten Domains).
  const listenNavLink = pageA.locator('a.link', { hasText: 'Listen' });
  await expect(listenNavLink.locator('.unseen-dot')).toHaveCount(0);

  // pageA never visits /todo itself - it should still learn about the change via SSE.
  await pageB.goto('/todo');
  await pageB.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Realtime-Sync-Test-Todo');
  await pageB.locator('.add-form button[type="submit"]').click();
  await expect(pageB.locator('li.row', { hasText: 'E2E Realtime-Sync-Test-Todo' })).toBeVisible();

  await expect(listenNavLink.locator('.unseen-dot')).toBeVisible();

  // Innerhalb von "Listen" muss der Punkt am ToDo-Tab selbst zu sehen sein, NICHT an den beiden
  // unbeteiligten Tabs - sonst müsste man alle drei Tabs nacheinander abklappern, um die
  // betroffene Liste zu finden (siehe ListenView.vue's TABS/liveSync.hasUnseen()-Verdrahtung).
  await pageA.goto('/listen');
  await expect(pageA.getByRole('tab', { name: 'Packliste' }).locator('.unseen-dot')).toHaveCount(0);
  await expect(pageA.getByRole('tab', { name: 'Einkauf' }).locator('.unseen-dot')).toHaveCount(0);
  await expect(pageA.getByRole('tab', { name: 'ToDo' }).locator('.unseen-dot')).toBeVisible();

  // Visiting the ToDo tab clears ITS unseen state (Tab-Punkt UND das gemeinsame Listen-Badge) und
  // zeigt den neuen Eintrag als "neu" hervorgehoben.
  await pageA.getByRole('tab', { name: 'ToDo' }).click();
  const newRow = pageA.locator('li.row', { hasText: 'E2E Realtime-Sync-Test-Todo' });
  await expect(newRow).toBeVisible();
  await expect(newRow).toHaveClass(/new-highlight/);
  await expect(pageA.getByRole('tab', { name: 'ToDo' }).locator('.unseen-dot')).toHaveCount(0);

  await pageA.getByRole('tab', { name: 'Packliste' }).click();
  await expect(pageA.locator('.packing-page')).toBeVisible();
  await pageA.getByRole('tab', { name: 'Einkauf' }).click();
  await expect(pageA.locator('.shopping-page')).toBeVisible();

  await expect(listenNavLink.locator('.unseen-dot')).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});

// Regressionsnetz für den Bugfix: 'ideas' (Touren) fehlte bisher komplett in der
// Nav-Punkt-Verdrahtung (navLinks.ts's Karte-Eintrag prüfte nur 'spots', ExcursionsView.vue rief
// nie markSeen('ideas') auf) - neue Touren lösten dadurch überhaupt keinen Punkt aus. Prüft
// zusätzlich, dass der Spots/Touren-Umschalter in ExcursionsView.vue selbst anzeigt, WELCHE der
// beiden Gruppierungen betroffen ist, und dass nur ein tatsächlicher Wechsel dorthin den Punkt löscht
// (bloßes Öffnen der Karte-Sicht im Spots-Modus darf den Touren-Punkt nicht mitlöschen).
test('another member creating a tour lights up the Karte nav badge and the Touren toggle, not the Spots one', async ({
  browser,
}) => {
  const ctxA = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const ctxB = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  async function login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(username);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('.trip-name').first()).toBeVisible();
  }

  await login(pageA, E2E_USERNAME, E2E_PASSWORD);
  await login(pageB, E2E_USERNAME_2, E2E_PASSWORD_2);

  const excursionsNavLink = pageA.locator('a.link', { hasText: 'Karte' });
  await expect(excursionsNavLink.locator('.unseen-dot')).toHaveCount(0);

  const tourTitle = `E2E Realtime-Sync-Test-Tour ${Date.now()}`;
  const createRes = await pageB.request.post('/api/ideas', {
    data: { trip_id: seeded.trip.id, title: tourTitle, spot_ids: [] },
  });
  expect(createRes.ok()).toBeTruthy();

  await expect(excursionsNavLink.locator('.unseen-dot')).toBeVisible();

  // Öffnen der Karte-Sicht im Default-Modus (Kategorie/Spots) markiert nur 'spots' als gesehen -
  // 'ideas' bleibt unbesehen, der äußere Nav-Punkt UND der Touren-Toggle müssen also weiterhin
  // einen Punkt zeigen, der Spots-Toggle dagegen nicht.
  await pageA.goto('/excursions');
  // #155: der Spots-/Touren-Umschalter sitzt seither direkt neben der Drawer-Überschrift
  // (ExcursionsView.vue's .header h2), nicht mehr in der einklappbaren Gruppieren-Zeile der
  // Anzeige & Filter-Box - dadurch immer sichtbar, unabhängig von Viewport-Breite.
  const groupToggle = pageA.locator('.header h2');
  await expect(groupToggle).toBeVisible();
  await expect(groupToggle.getByRole('button', { name: 'Spots' }).locator('.segmented-dot')).toHaveCount(0);
  await expect(groupToggle.getByRole('button', { name: 'Touren' }).locator('.segmented-dot')).toBeVisible();
  await expect(excursionsNavLink.locator('.unseen-dot')).toBeVisible();

  // Erst der tatsächliche Wechsel auf die Touren-Gruppierung löscht deren Punkt UND (da 'spots' es
  // bereits war) damit auch den äußeren Karte-Punkt vollständig.
  await groupToggle.getByRole('button', { name: 'Touren' }).click();
  await expect(pageA.locator('.excursion-card', { hasText: tourTitle })).toBeVisible();
  await expect(groupToggle.getByRole('button', { name: 'Touren' }).locator('.segmented-dot')).toHaveCount(0);
  await expect(excursionsNavLink.locator('.unseen-dot')).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});

// Regressionsnetz für PresenceAvatars.vue's Umstellung von "nur online" auf "alle Mitreisenden,
// online/offline unterschieden" (siehe dortiger Kommentar).
test('presence avatars show an offline member grayed out and mark them online once they connect', async ({ browser }) => {
  const ctxA = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const ctxB = await newContextWithReducedMotion(browser, { storageState: { cookies: [], origins: [] } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();

  async function login(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Benutzername').fill(username);
    await page.getByLabel('Passwort').fill(password);
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
    await expect(page.locator('.trip-name').first()).toBeVisible();
  }

  await login(pageA, E2E_USERNAME, E2E_PASSWORD);

  // Zweites Mitglied ist noch nicht eingeloggt - sein Avatar muss trotzdem (ausgegraut) sichtbar
  // sein, da PresenceAvatars.vue jetzt alle Trip-Mitglieder zeigt, nicht mehr nur online welche.
  const memberAvatar = pageA.locator(`.presence-avatar[title*="${E2E_USERNAME_2}"]`);
  await expect(memberAvatar).toBeVisible();
  await expect(memberAvatar).toHaveClass(/offline/);
  await expect(memberAvatar.locator('.online-dot')).toHaveCount(0);

  await login(pageB, E2E_USERNAME_2, E2E_PASSWORD_2);

  await expect(memberAvatar).not.toHaveClass(/offline/);
  await expect(memberAvatar.locator('.online-dot')).toBeVisible();

  await ctxB.close();

  await expect(memberAvatar).toHaveClass(/offline/, { timeout: 15_000 });

  await ctxA.close();
});
