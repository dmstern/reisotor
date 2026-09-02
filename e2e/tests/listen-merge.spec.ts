import { test, expect } from '@playwright/test';

// Regressionsnetz für den "Listen"-Merge (Packliste + Einkauf + ToDo -> ein Tab-View, siehe
// ListenView.vue/router/index.ts/NavBar.vue): die höchste Regressionsfläche in diesem Backlog, da
// Routing, drei zusammengeführte Views und ein Querverweis gleichzeitig betroffen sind.
test('old /packing, /shopping, /todo routes redirect into the tabbed Listen view', async ({
  page,
}) => {
  await page.goto('/abc-123/packing');
  await expect(page).toHaveURL(/\/listen\?tab=packing/);
  await expect(page.locator('.packing-page')).toBeVisible();

  await page.goto('/abc-123/shopping');
  await expect(page).toHaveURL(/\/listen\?tab=shopping/);
  await expect(page.locator('.shopping-page')).toBeVisible();

  await page.goto('/abc-123/todo');
  await expect(page).toHaveURL(/\/listen\?tab=todo/);
  await expect(page.locator('.todo-page')).toBeVisible();
});

test('switching tabs mounts the correct list without navigating away from /listen', async ({
  page,
}) => {
  await page.goto('/abc-123/listen');
  await expect(page.locator('.packing-page')).toBeVisible();

  await page.getByRole('tab', { name: 'Einkauf' }).click();
  await expect(page).toHaveURL(/\/listen\?tab=shopping/);
  await expect(page.locator('.shopping-page')).toBeVisible();
  await expect(page.locator('.packing-page')).toHaveCount(0);

  await page.getByRole('tab', { name: 'ToDo' }).click();
  await expect(page).toHaveURL(/\/listen\?tab=todo/);
  await expect(page.locator('.todo-page')).toBeVisible();
  await expect(page.locator('.shopping-page')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Packliste' }).click();
  await expect(page.locator('.packing-page')).toBeVisible();
});

test('NavBar shows exactly one merged "Listen" entry with the clipboard icon', async ({ page }) => {
  await page.goto('/');
  const listenLink = page.locator('nav.navbar a[href*="/listen"]');
  await expect(listenLink).toHaveCount(1);
  await expect(listenLink).toContainText('📋');
  await expect(listenLink).toContainText('Listen');
  await expect(page.locator('nav.navbar a[href="/packing"]')).toHaveCount(0);
  await expect(page.locator('nav.navbar a[href="/shopping"]')).toHaveCount(0);
  await expect(page.locator('nav.navbar a[href="/todo"]')).toHaveCount(0);
});

test('a calendar cross-reference to a todo lands on the todo tab with the item highlighted', async ({
  page,
}) => {
  await page.goto('/abc-123/listen?tab=todo');
  await page.getByPlaceholder('Neue Aufgabe').fill('E2E Listen-Merge Querverweis');
  const todayIso = new Date().toISOString().slice(0, 10);
  await page.locator('input[type="date"]').first().fill(todayIso);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('.row', { hasText: 'E2E Listen-Merge Querverweis' })).toBeVisible();

  await page.goto('/');
  await page.locator(`.day[data-date="${todayIso}"]`).click();
  await page
    .locator('.day-detail .items .item', { hasText: 'E2E Listen-Merge Querverweis' })
    .click();

  await expect(page).toHaveURL(/\/listen\?tab=todo#todo-\d+/);
  await expect(
    page.locator('.row.new-highlight', { hasText: 'E2E Listen-Merge Querverweis' })
  ).toBeVisible();
});
