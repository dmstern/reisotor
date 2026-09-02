import { test, expect } from '@playwright/test';

// Regressionsnetz für ImageUrlInput.vue (Bild-URL-Textfeld + direkter Datei-Upload, siehe
// backend/src/routes/images.ts) im Spot-Formular (ExcursionsView.vue) - stellvertretend für alle
// fünf Stellen, die dieselbe Komponente nutzen (Spot neu/bearbeiten, Tour neu/bearbeiten,
// TripForm.vue), da sie überall identisch verdrahtet ist.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('Spot-Formular: Bild lässt sich direkt hochladen statt nur per URL zu verlinken', async ({
  page,
}) => {
  const marker = `E2E-Bild-Upload-${Date.now()}`;
  const spotTitle = `Café ${marker}`;

  await page.goto('/abc-123/excursions');
  await page.getByRole('button', { name: 'Neuer Spot' }).click();

  const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
  await modal.waitFor({ state: 'visible' });
  await modal.getByRole('button', { name: 'Bild hinzufügen' }).click();
  const imageSubModal = page.locator('.modal', { hasText: 'Spot-Bild bearbeiten' });
  await imageSubModal.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  const imageInput = imageSubModal.locator('.image-url-input');
  const urlField = imageInput.locator('input[type="text"]');
  await expect(urlField).toHaveValue('');

  await imageInput.locator('input[type="file"]').setInputFiles({
    name: 'cover.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_BASE64, 'base64'),
  });

  // Nach dem Upload steht die vom Server zurückgegebene /api/uploads/-URL im selben Textfeld wie
  // eine manuell eingegebene URL - Upload und Textfeld sind dasselbe image_url-Feld, kein separater
  // Zustand.
  await expect(urlField).toHaveValue(/\/api\/uploads\//, { timeout: 10_000 });
  await imageSubModal.getByRole('button', { name: 'Fertig' }).click();
  await expect(imageSubModal).toBeHidden();

  await expect(modal.locator('.form-image-banner')).toHaveCSS('background-image', /api\/uploads/);

  await modal.locator('input[placeholder="Titel"]').fill(spotTitle);
  await modal.locator('form.edit-form button[type="submit"]').click();
  await expect(modal).toBeHidden();

  const spotCard = page.locator('.spot-card', { hasText: spotTitle });
  await expect(spotCard).toBeVisible();
  await expect(spotCard.locator('.image')).toHaveCSS('background-image', /api\/uploads/);
  await expect(spotCard.locator('.image .placeholder')).toHaveCount(0);
});
