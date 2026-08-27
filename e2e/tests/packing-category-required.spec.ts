import { test, expect } from '@playwright/test';

// Regressionsnetz für die neue Pro-Trip-Einstellung "Kategorie in der Packliste ist Pflichtfeld"
// (siehe TripForm.vue/routes/packing.ts): Umschalten in den Trip-Einstellungen muss das
// Packlisten-Formular sofort entsprechend reagieren lassen.
test('toggling the trip setting makes the packing category field required or optional', async ({
  page,
}) => {
  await page.goto('/');

  async function setCategoryRequired(required: boolean) {
    await page.locator('.switcher-btn').click();
    await page.locator('.trip-row.active').getByLabel('Bearbeiten').click();
    const checkbox = page.getByLabel('Kategorie in der Packliste ist Pflichtfeld');
    if (!(await checkbox.isVisible())) {
      await page.getByRole('button', { name: 'Optionale Angaben' }).click();
    }
    await expect(checkbox).toBeVisible();
    if ((await checkbox.isChecked()) !== required) await checkbox.click();
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(checkbox).toHaveCount(0);
  }

  await setCategoryRequired(false);

  await page.goto('/packing');
  const sharedList = page.locator('.list-section', { hasText: 'Gemeinsame Packliste' });
  const quickAddLabel = sharedList.getByPlaceholder('Neuer Gegenstand für 👥 Gemeinsame Packliste');
  await quickAddLabel.click();
  await expect(sharedList.getByPlaceholder('Kategorie (optional)', { exact: true })).toBeVisible();

  await quickAddLabel.fill('E2E Ohne Kategorie erlaubt');
  await quickAddLabel.press('Enter');
  await expect(sharedList.locator('.row', { hasText: 'E2E Ohne Kategorie erlaubt' })).toBeVisible();

  await setCategoryRequired(true);

  await page.goto('/packing');
  const sharedList2 = page.locator('.list-section', { hasText: 'Gemeinsame Packliste' });
  const quickAddLabel2 = sharedList2.getByPlaceholder(
    'Neuer Gegenstand für 👥 Gemeinsame Packliste'
  );
  await quickAddLabel2.click();
  const categoryField = sharedList2.getByPlaceholder('Kategorie', { exact: true });
  await expect(categoryField).toBeVisible();
  // Pflicht -> vorbelegt mit "Sonstiges" statt leer.
  await expect(categoryField).toHaveValue('Sonstiges');

  // Wird die Kategorie explizit geleert, darf der Gegenstand nicht angelegt werden.
  await categoryField.fill('');
  await quickAddLabel2.fill('E2E Sollte nicht angelegt werden');
  await quickAddLabel2.press('Enter');
  await expect(
    sharedList2.locator('.row', { hasText: 'E2E Sollte nicht angelegt werden' })
  ).toHaveCount(0);
});
