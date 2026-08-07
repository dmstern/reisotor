import { test, expect } from '@playwright/test';

// Regressionsnetz für "abgehakte Einträge sinken ans Gruppenende und werden ausgegraut" (siehe
// composables/useCheckedSort.ts) - bisher nur in TodoView.vue vorhanden, jetzt auch in der
// Einkaufsliste und der Packliste.
test('checking an item in the shopping list sinks it to the bottom of its group and grays it out', async ({ page }) => {
  await page.goto('/shopping');

  await page.getByPlaceholder('Neuer Artikel').fill('E2E Sort A');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await page.getByPlaceholder('Neuer Artikel').fill('E2E Sort B');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

  const group = page.locator('.group-section', { hasText: 'Nicht zugewiesen' });
  const rowA = group.locator('.row', { hasText: 'E2E Sort A' });
  const rowB = group.locator('.row', { hasText: 'E2E Sort B' });
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();

  // A wurde zuerst angelegt, steht also zunächst vor B.
  await expect.poll(async () => {
    const texts = await group.locator('.row').allTextContents();
    return texts.findIndex((t) => t.includes('E2E Sort A')) < texts.findIndex((t) => t.includes('E2E Sort B'));
  }).toBe(true);

  await rowA.locator('input[type="checkbox"]').click();

  await expect(rowA).toHaveClass(/row-done/);
  await expect(rowA.locator('span.text-done', { hasText: 'E2E Sort A' })).toBeVisible();

  // Nach dem Abhaken steht A hinter B, obwohl A zuerst angelegt wurde.
  await expect.poll(async () => {
    const texts = await group.locator('.row').allTextContents();
    return texts.findIndex((t) => t.includes('E2E Sort A')) > texts.findIndex((t) => t.includes('E2E Sort B'));
  }).toBe(true);
});

test('marking a packing item as packed sinks it to the bottom of its category group and grays it out', async ({ page }) => {
  await page.goto('/packing');

  const sharedList = page.locator('.list-section', { hasText: 'Gemeinsame Packliste' });
  const quickAddLabel = sharedList.getByPlaceholder('Neuer Gegenstand für Gemeinsame Packliste');

  await quickAddLabel.fill('E2E Pack A');
  await quickAddLabel.press('Enter');
  await quickAddLabel.fill('E2E Pack B');
  await quickAddLabel.press('Enter');

  const group = sharedList.locator('.group', { hasText: 'Sonstiges' });
  const rowA = group.locator('.row', { hasText: 'E2E Pack A' });
  const rowB = group.locator('.row', { hasText: 'E2E Pack B' });
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();

  await rowA.locator('.state-toggle').click(); // ungepackt -> rausgelegt
  await rowA.locator('.state-toggle').click(); // rausgelegt -> eingepackt

  await expect(rowA).toHaveClass(/row-done/);
  await expect(rowA.locator('span.text-done', { hasText: 'E2E Pack A' })).toBeVisible();

  await expect.poll(async () => {
    const texts = await group.locator('.row').allTextContents();
    return texts.findIndex((t) => t.includes('E2E Pack A')) > texts.findIndex((t) => t.includes('E2E Pack B'));
  }).toBe(true);
});
