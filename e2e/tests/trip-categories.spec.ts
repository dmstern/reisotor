import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seeded = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'seeded-data.json'), 'utf-8')
);

test.describe('Trip Categories Management', () => {
  test('allows managing custom categories in trip edit modal and reflects in category combobox', async ({
    page,
  }) => {
    // 1. Go to /trips
    await page.goto('/trips');
    const tripCard = page.locator('.trip-card', { hasText: seeded.trip.name });
    await expect(tripCard).toBeVisible();

    // 2. Open trip edit modal
    await tripCard.getByRole('button', { name: 'Bearbeiten' }).click();

    // 3. Switch to "Kategorien" tab
    const modal = page.locator('.modal', { hasText: 'Urlaub bearbeiten' });
    await expect(modal).toBeVisible();
    await modal.getByRole('tab', { name: 'Kategorien' }).click();

    // 4. Verify scope nav (Ausgaben & Spots)
    await expect(modal.getByRole('tab', { name: 'Ausgaben' })).toBeVisible();
    await expect(modal.getByRole('tab', { name: 'Spots' })).toBeVisible();

    // 5. Create a new custom expense category
    await modal.getByRole('button', { name: 'Neue Kategorie' }).click();
    const uniqueCategory = `Tauchen ${Date.now()}`;
    await modal.getByPlaceholder('z. B. Souvenirs oder Bootsverleih').fill(uniqueCategory);
    await modal.getByRole('button', { name: 'Kategorie erstellen' }).click();

    // 6. Verify newly created category is in the list with "Urlaub" badge
    const createdRow = modal.locator('.category-row', { hasText: uniqueCategory });
    await expect(createdRow).toBeVisible();
    await expect(createdRow.locator('.kind-badge')).toHaveText('Urlaub');

    // 7. Edit the category name inline
    await createdRow.getByRole('button', { name: 'Kategorie bearbeiten' }).click();
    const updatedCategory = `${uniqueCategory} & Schnorcheln`;
    const editInput = modal.locator('.inline-edit-form input').first();
    await editInput.fill(updatedCategory);
    await modal.getByRole('button', { name: 'Änderungen speichern' }).click();

    // 8. Verify the updated name appears
    const updatedRow = modal.locator('.category-row', { hasText: updatedCategory });
    await expect(updatedRow).toBeVisible();

    // 9. Close modal
    await modal.getByRole('button', { name: 'Schließen' }).click();
    await expect(modal).not.toBeVisible();

    // 10. Navigate to /budget, open "Ausgabe eintragen", verify new category in combobox
    await page.goto('/budget');
    await expect(page.locator('.budget-page')).toBeVisible();

    await page.getByRole('button', { name: 'Ausgabe eintragen' }).click();
    const expenseModal = page.locator('.modal', { hasText: 'Ausgabe eintragen' });
    await expect(expenseModal).toBeVisible();

    // In expense modal, open the category combobox
    const categoryInput = expenseModal.getByPlaceholder('Kategorie');
    await expect(categoryInput).toBeVisible();
    await categoryInput.click();
    await categoryInput.fill('Tauchen');

    // Verify dropdown suggestion includes updatedCategory
    await expect(expenseModal.getByRole('option', { name: updatedCategory })).toBeVisible();

    // Close expense modal
    await expenseModal.getByRole('button', { name: 'Schließen' }).click();
    await expect(expenseModal).not.toBeVisible();

    // 11. Go back to /trips and delete the custom category
    await page.goto('/trips');
    await expect(page.locator('.trip-card', { hasText: seeded.trip.name })).toBeVisible();
    await page
      .locator('.trip-card', { hasText: seeded.trip.name })
      .getByRole('button', { name: 'Bearbeiten' })
      .click();
    const editModal = page.locator('.modal', { hasText: 'Urlaub bearbeiten' });
    await expect(editModal).toBeVisible();
    await editModal.getByRole('tab', { name: 'Kategorien' }).click();

    const rowToDelete = editModal.locator('.category-row', { hasText: updatedCategory });
    await expect(rowToDelete).toBeVisible();
    await rowToDelete.getByRole('button', { name: 'Kategorie löschen' }).click();

    // Confirm deletion
    const deleteConfirmModal = page.locator('.modal', { hasText: 'Kategorie löschen' });
    await expect(deleteConfirmModal).toBeVisible();
    await deleteConfirmModal.getByRole('button', { name: 'Kategorie endgültig löschen' }).click();

    // Verify row is deleted
    await expect(editModal.locator('.category-row', { hasText: updatedCategory })).toHaveCount(0);
  });
});
