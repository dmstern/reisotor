import { test, expect } from '@playwright/test';

// Regressionsnetz für die neuen Inline-Quick-Add-Zeilen direkt in Gruppen-Kopfzeilen (siehe
// QuickAddRow.vue) - bisher gab es dieses "auf die Liste weiterschreiben"-Muster nur bei der
// Packliste, jetzt auch bei Einkauf und ToDo.
test('quick-adding into a shopping group creates the item pre-filled with that group’s dimension', async ({
  page,
}) => {
  await page.goto('/abc-123/shopping');
  await expect(page.locator('.shopping-page')).toBeVisible();

  // Gruppierung explizit auf 'buyer' (Einkäufer:in) stellen, falls sie durch vorherige Tests im localStorage abweicht.
  await page.locator('.shopping-page .filter-row select').first().selectOption('buyer');

  const group = page.locator('.shopping-page .group-section', { hasText: 'Nicht zugewiesen' });
  await expect(group).toBeVisible();

  const quickAdd = group.locator('.quick-add-row').first();
  await expect(quickAdd).toBeVisible();

  const input = quickAdd.getByPlaceholder('Artikel hinzufügen…');
  await expect(input).toBeVisible();

  // Im Ruhezustand nur das dezente Label-Feld, keine Zusatzfelder sichtbar.
  await expect(quickAdd.locator('select')).toHaveCount(0);

  await input.click();
  await expect(input).toBeFocused();

  // groupBy ist 'buyer' - Zusatzfelder für die jeweils anderen Dimensionen (Shop-
  // Combobox + Zeitraum-Select), aber kein Bearbeiter:innen-Select (das ist ja schon die Gruppe).
  await expect(quickAdd.locator('select')).toHaveCount(1);
  await expect(quickAdd.locator('.combobox')).toHaveCount(1);

  await input.fill('E2E Quick-Add Einkauf');
  await input.press('Enter');

  const row = group.locator('.row', { hasText: 'E2E Quick-Add Einkauf' });
  await expect(row).toBeVisible();
});

test('quick-adding into a todo group creates the item assigned to that group’s person', async ({
  page,
}) => {
  await page.goto('/abc-123/todo');
  await expect(page.locator('.todo-page')).toBeVisible();

  // Gruppierung explizit auf 'assignee' (Bearbeiter:in) stellen.
  await page.locator('.todo-page .filter-row select').first().selectOption('assignee');

  const group = page.locator('.todo-page .group-section', { hasText: 'Nicht zugewiesen' });
  await expect(group).toBeVisible();

  const quickAdd = group.locator('.quick-add-row').first();
  await expect(quickAdd).toBeVisible();

  const input = quickAdd.locator('input[type="text"]');
  await expect(input).toBeVisible();

  await input.click();
  await expect(input).toBeFocused();

  await input.fill('E2E Quick-Add ToDo');
  await input.press('Enter');

  const row = group.locator('.row', { hasText: 'E2E Quick-Add ToDo' });
  await expect(row).toBeVisible();
});
