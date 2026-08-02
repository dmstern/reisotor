import { test, expect, type Page } from '@playwright/test';
import { E2E_PASSWORD, E2E_PASSWORD_2, E2E_USERNAME, E2E_USERNAME_2 } from '../constants.js';

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
  const ctxA = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const ctxB = await browser.newContext({ storageState: { cookies: [], origins: [] } });
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

  const todoNavLink = pageA.locator('a.link', { hasText: 'ToDo' });
  await expect(todoNavLink.locator('.unseen-dot')).toHaveCount(0);

  // pageA never visits /todo itself - it should still learn about the change via SSE.
  await pageB.goto('/todo');
  await pageB.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Realtime-Sync-Test-Todo');
  await pageB.locator('.add-form button[type="submit"]').click();
  await expect(pageB.locator('li.row', { hasText: 'E2E Realtime-Sync-Test-Todo' })).toBeVisible();

  await expect(todoNavLink.locator('.unseen-dot')).toBeVisible();

  // Visiting the ToDo view clears the badge and shows the new item highlighted as "neu".
  await pageA.goto('/todo');
  const newRow = pageA.locator('li.row', { hasText: 'E2E Realtime-Sync-Test-Todo' });
  await expect(newRow).toBeVisible();
  await expect(newRow).toHaveClass(/new-highlight/);
  await expect(todoNavLink.locator('.unseen-dot')).toHaveCount(0);

  await ctxA.close();
  await ctxB.close();
});
