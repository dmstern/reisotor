import { test, expect } from '@playwright/test';

// Regressionsnetz für "abgehakte Einträge sinken ans Gruppenende und werden ausgegraut" (siehe
// composables/useCheckedSort.ts) - bisher nur in TodoView.vue vorhanden, jetzt auch in der
// Einkaufsliste und der Packliste.
test('checking an item in the shopping list sinks it to the bottom of its group and grays it out', async ({
  page,
}) => {
  await page.goto('/abc-123/shopping');

  const group = page.locator('.group-section', { hasText: 'Nicht zugewiesen' });
  const rowA = group.locator('.row', { hasText: 'E2E Sort A' });
  const rowB = group.locator('.row', { hasText: 'E2E Sort B' });

  await page.getByPlaceholder('Neuer Artikel').fill('E2E Sort A');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  // Erst auf das Eintreffen von A warten, bevor B hinzugefügt wird - sonst können sich der noch
  // laufende Request/State-Reset des ersten Hinzufügens und das Ausfüllen des zweiten Artikels
  // überschneiden (beobachtete CI-Flakiness, wo B nie auftauchte).
  await expect(rowA).toBeVisible();

  await page.getByPlaceholder('Neuer Artikel').fill('E2E Sort B');
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(rowB).toBeVisible();

  // A wurde zuerst angelegt, steht also zunächst vor B.
  await expect
    .poll(async () => {
      const texts = await group.locator('.row').allTextContents();
      return (
        texts.findIndex((t) => t.includes('E2E Sort A')) <
        texts.findIndex((t) => t.includes('E2E Sort B'))
      );
    })
    .toBe(true);

  await rowA.locator('input[type="checkbox"]').click();

  await expect(rowA).toHaveClass(/row-done/);
  await expect(rowA.locator('span.text-done', { hasText: 'E2E Sort A' })).toBeVisible();

  // Nach dem Abhaken steht A hinter B, obwohl A zuerst angelegt wurde.
  await expect
    .poll(async () => {
      const texts = await group.locator('.row').allTextContents();
      return (
        texts.findIndex((t) => t.includes('E2E Sort A')) >
        texts.findIndex((t) => t.includes('E2E Sort B'))
      );
    })
    .toBe(true);
});

test('marking a packing item as packed sinks it to the bottom of its category group and grays it out', async ({
  page,
}) => {
  await page.goto('/abc-123/packing');

  const sharedList = page.locator('.list-section', { hasText: 'Gemeinsame Packliste' });
  const quickAddLabel = sharedList.getByPlaceholder('Neuer Gegenstand für 👥 Gemeinsame Packliste');

  const group = sharedList.locator('.group', { hasText: 'Sonstiges' });
  const rowA = group.locator('.row', { hasText: 'E2E Pack A' });
  const rowB = group.locator('.row', { hasText: 'E2E Pack B' });

  await quickAddLabel.fill('E2E Pack A');
  await quickAddLabel.press('Enter');
  await expect(rowA).toBeVisible();

  await quickAddLabel.fill('E2E Pack B');
  await quickAddLabel.press('Enter');
  await expect(rowB).toBeVisible();

  await rowA.locator('.state-toggle').click(); // ungepackt -> rausgelegt
  await rowA.locator('.state-toggle').click(); // rausgelegt -> eingepackt

  await expect(rowA).toHaveClass(/row-done/);
  await expect(rowA.locator('span.text-done', { hasText: 'E2E Pack A' })).toBeVisible();

  await expect
    .poll(async () => {
      const texts = await group.locator('.row').allTextContents();
      return (
        texts.findIndex((t) => t.includes('E2E Pack A')) >
        texts.findIndex((t) => t.includes('E2E Pack B'))
      );
    })
    .toBe(true);
});

// Regressionsnetz für den neuen "alles auf einmal einpacken"-Toggle bei Anzahl > 1 (siehe
// PackingItem.vue's toggleAllPacked()) - vorher gab es dafür nur die Strichliste, kein einzelnes
// Häkchen wie bei Anzahl 1.
test('a quantity>1 packing item can be marked fully packed with a single toggle click', async ({
  page,
}) => {
  await page.goto('/abc-123/packing');

  const sharedList = page.locator('.list-section', { hasText: 'Gemeinsame Packliste' });
  const quickAddLabel = sharedList.getByPlaceholder('Neuer Gegenstand für 👥 Gemeinsame Packliste');
  // Die Zusatzfelder (Kategorie/Unterkategorie/Anzahl) rendern erst, sobald die Quick-Add-Zeile
  // fokussiert/expandiert ist (siehe QuickAddRow.vue).
  await quickAddLabel.click();
  await sharedList.locator('.quick-add-qty input').fill('3');
  await quickAddLabel.fill('E2E Pack Qty');
  await quickAddLabel.press('Enter');

  const row = sharedList.locator('.row', { hasText: 'E2E Pack Qty' });
  await expect(row).toBeVisible();
  await expect(row.locator('.tally-control')).toBeVisible();

  const packAllToggle = row.locator('.state-toggle');
  await expect(packAllToggle).toBeVisible();
  await packAllToggle.click();

  await expect(row).toHaveClass(/row-done/);
  await expect(row.locator('span.text-done', { hasText: 'E2E Pack Qty' })).toBeVisible();
  await expect(row.locator('.tally-pill')).toHaveClass(/packed/);

  await packAllToggle.click();
  await expect(row).not.toHaveClass(/row-done/);
});
