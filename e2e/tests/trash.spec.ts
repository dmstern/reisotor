import { test, expect } from '@playwright/test';

// Regressionsnetz für den weichen Löschvorgang (Papierkorb, siehe CLAUDE.md/routes/trash.ts):
// Löschen soll nicht endgültig sein, sondern für 60s eine "Löschen rückgängig machen"-Möglichkeit
// direkt an der Stelle des Objekts bieten sowie dauerhaft über einen Papierkorb im
// Einstellungsmenü (Profil, Avatar-Klick) wiederherstellbar sein. Nutzt ToDo als Stellvertreter für
// alle elf betroffenen Objekttypen (identisches Muster, siehe useUndoableDelete.ts).

test('deleting an item shows an inline "Löschen rückgängig machen" placeholder, and undo restores it', async ({
  page,
}) => {
  await page.goto('/todo');
  await page.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Undo-Test-Aufgabe');
  await page.locator('.add-form button[type="submit"]').click();

  const row = page.locator('li.row', { hasText: 'E2E Undo-Test-Aufgabe' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Löschen' }).click();
  await page.waitForTimeout(300); // Transition-Group-Übergang abwarten (0.2s, siehe style.css)

  // Nach dem Löschen: Zeile bleibt an ihrer Stelle, zeigt aber nur noch den Undo-Platzhalter statt
  // der normalen (Checkbox/Bearbeiten/Löschen-Icons enthaltenden) Zeile.
  const undoRow = page.locator('.undo-delete-row', { hasText: 'E2E Undo-Test-Aufgabe' });
  await expect(undoRow).toBeVisible();
  await expect(page.locator('.check', { hasText: 'E2E Undo-Test-Aufgabe' })).toHaveCount(0);

  await undoRow.getByRole('button', { name: 'Löschen rückgängig machen' }).click();
  await page.waitForTimeout(300); // Transition-Group-Übergang abwarten (0.2s, siehe style.css)

  await expect(page.locator('.undo-delete-row')).toHaveCount(0);
  await expect(page.locator('.check', { hasText: 'E2E Undo-Test-Aufgabe' })).toBeVisible();
});

test('the trash view (reachable via profile/avatar) lists a deleted item and restores it', async ({ page }) => {
  await page.goto('/todo');
  await page.locator('input[placeholder="Neue Aufgabe"]').fill('E2E Papierkorb-Test-Aufgabe');
  await page.locator('.add-form button[type="submit"]').click();
  const row = page.locator('li.row', { hasText: 'E2E Papierkorb-Test-Aufgabe' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Löschen' }).click();
  await page.waitForTimeout(300); // Transition-Group-Übergang abwarten (0.2s, siehe style.css)
  await expect(page.locator('.check', { hasText: 'E2E Papierkorb-Test-Aufgabe' })).toHaveCount(0);

  // Erreichbarkeit über das Einstellungsmenü (Klick auf den Avatar -> Profil -> "Daten"-Tab ->
  // Papierkorb-Karte).
  await page.locator('.profile-link').click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole('tab', { name: 'Daten' }).click();
  await page.getByRole('link', { name: 'Papierkorb öffnen' }).click();
  await expect(page).toHaveURL(/\/trash$/);

  const trashRow = page.locator('.trash-row', { hasText: 'E2E Papierkorb-Test-Aufgabe' });
  await expect(trashRow).toBeVisible();
  await trashRow.getByRole('button', { name: 'Wiederherstellen' }).click();
  await expect(trashRow).toHaveCount(0);

  await page.goto('/todo');
  await expect(page.locator('li.row', { hasText: 'E2E Papierkorb-Test-Aufgabe' })).toBeVisible();
});
