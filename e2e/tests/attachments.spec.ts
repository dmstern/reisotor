import { test, expect } from '@playwright/test';

// Regressionsnetz für Datei-Anhänge (FileAttachments.vue/backend/src/routes/attachments.ts):
// eine Datei an einer Notiz hochladen, sehen und wieder löschen. Notizen statt einer der anderen
// vier verdrahteten Domänen (Reise/Unterkunft/Termin/Budget), da sie ohne zusätzliche Pflichtfelder
// (Datum, Ort, Betrag) mit einem einzigen Formularfeld anlegbar sind.
test('uploading and removing a file attachment on a note', async ({ page }) => {
  await page.goto('/notes');
  await page.getByRole('button', { name: '+ Neue Notiz' }).click();
  await page.locator('textarea[placeholder="Inhalt"]').fill('E2E Anhang-Test-Notiz');
  await page.locator('.add-form button[type="submit"]').click();

  const card = page.locator('.note-card', { hasText: 'E2E Anhang-Test-Notiz' });
  await expect(card).toBeVisible();

  const fileInput = card.locator('.file-attachments input[type="file"]');
  await fileInput.setInputFiles({
    name: 'ticket.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  });

  const attachmentRow = card.locator('.attachment-row', { hasText: 'ticket.png' });
  await expect(attachmentRow).toBeVisible();

  await attachmentRow.locator('.remove-btn').click();
  await expect(attachmentRow).toHaveCount(0);
});
