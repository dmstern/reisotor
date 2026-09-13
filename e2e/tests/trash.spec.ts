import { test, expect } from '@playwright/test';

// Regressionsnetz für den weichen Löschvorgang (Papierkorb, siehe CLAUDE.md/routes/trash.ts):
// Löschen soll nicht endgültig sein, sondern für 60s eine "Löschen rückgängig machen"-Möglichkeit
// direkt an der Stelle des Objekts bieten sowie dauerhaft über einen Papierkorb im
// Einstellungsmenü (Einstellungen, Avatar-Klick) wiederherstellbar sein. Nutzt ToDo als Stellvertreter für
// alle elf betroffenen Objekttypen (identisches Muster, siehe useUndoableDelete.ts).

test('deleting an item shows a toast notification and removes the item', async ({ page }) => {
  await page.goto('/todo');
  await page.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Undo-Test-Aufgabe');
  await page.locator('.add-form button[type="submit"]').click();

  const row = page.locator('li.row', { hasText: 'E2E Undo-Test-Aufgabe' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Löschen' }).click();

  // Nach dem Löschen: Toast-Benachrichtigung erscheint und die Zeile ist entfernt
  const toast = page.locator('.toast-item', {
    hasText: 'Aufgabe gelöscht. Sie befindet sich nun im Papierkorb.',
  });
  await expect(toast).toBeVisible();
  await expect(page.locator('.check', { hasText: 'E2E Undo-Test-Aufgabe' })).toHaveCount(0);
});

test('the trash view (reachable via trip dashboard) lists a deleted item and restores it', async ({
  page,
}) => {
  await page.goto('/todo');
  await page.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Papierkorb-Test-Aufgabe');
  await page.locator('.add-form button[type="submit"]').click();
  const row = page.locator('li.row', { hasText: 'E2E Papierkorb-Test-Aufgabe' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Löschen' }).click();
  await page.waitForTimeout(300); // Transition-Group-Übergang abwarten (0.2s, siehe style.css)
  await expect(page.locator('.check', { hasText: 'E2E Papierkorb-Test-Aufgabe' })).toHaveCount(0);

  // Erreichbarkeit über das Trip-Dashboard (Übersicht -> Kachel auf dem Dashboard)
  await page.getByRole('link', { name: 'Übersicht' }).click();
  await expect(page).toHaveURL(/\/trip\/\d+$/);

  const trashTile = page.locator('a.tile[href$="/trash"]');
  await expect(trashTile).toBeVisible();
  await trashTile.click();
  await expect(page).toHaveURL(/\/trip\/\d+\/trash$/);

  const trashRow = page.locator('.trash-row', { hasText: 'E2E Papierkorb-Test-Aufgabe' });
  await expect(trashRow).toBeVisible();
  await trashRow.getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(trashRow).toHaveCount(0);

  await page.goto('/todo');
  await expect(page.locator('li.row', { hasText: 'E2E Papierkorb-Test-Aufgabe' })).toBeVisible();
});

test('the trash nav-item can be enabled in settings and used for navigation', async ({ page }) => {
  await page.goto('/settings?tab=app');
  const navRow = page.locator('.nav-config-row', { hasText: 'Papierkorb' });
  await expect(navRow).toBeVisible();
  const checkbox = navRow.getByRole('checkbox');
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  // Papierkorb-Link ist nun in der NavBar sichtbar und navigiert zum Trip-Papierkorb
  const navLink = page.locator('nav.navbar a.link[href$="/trash"]');
  await expect(navLink).toBeVisible();
  await navLink.click();
  await expect(page).toHaveURL(/\/trip\/\d+\/trash$/);
});
