import { test, expect } from '@playwright/test';

// Regressionsnetz für Datei-Anhänge (FileAttachments.vue/backend/src/routes/attachments.ts):
// eine Datei an einer Notiz hochladen, sehen und wieder löschen. Notizen statt einer der anderen
// vier verdrahteten Domänen (Reise/Unterkunft/Termin/Budget), da sie ohne zusätzliche Pflichtfelder
// (Datum, Ort, Betrag) mit einem einzigen Formularfeld anlegbar sind.
//
// Upload/Löschen laufen bewusst über das "Notiz bearbeiten"-Formular, NICHT über die Karten-Ansicht:
// FileAttachments.vue's :editable-Prop blendet den Upload-/Löschen-Button im reinen Ansichtsmodus
// aus (siehe file-attachments-view-mode.spec.ts für den dedizierten Regressionstest dieses
// Verhaltens selbst) - hier geht es nur um den eigentlichen Upload/Löschen-Ablauf.
test('uploading and removing a file attachment on a note (via edit form)', async ({ page }) => {
  await page.goto('/notes');
  await page.getByRole('button', { name: 'Neue Notiz' }).click();
  const editor = page.locator('.modal .richtext-content[contenteditable="true"]');
  await editor.click();
  await editor.pressSequentially('E2E Anhang-Test-Notiz');
  await page.locator('.add-form button[type="submit"]').click();

  const card = page.locator('.note-card', { hasText: 'E2E Anhang-Test-Notiz' });
  await expect(card).toBeVisible();
  await card
    .locator('.note-actions')
    .getByRole('button', { name: /bearbeiten/i })
    .click();

  const modal = page.locator('.modal', { hasText: 'Notiz bearbeiten' });
  const fileInput = modal.locator('.file-attachments input[type="file"]');
  await fileInput.setInputFiles({
    name: 'ticket.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    ),
  });

  // 1. Initialer Status: gestapelt (Mini-Polaroid-Stack)
  const stack = modal.locator('.thumbnails-stacked-container .polaroid-stack');
  await expect(stack).toBeVisible();

  // 2. Klick auf den Stapel: auffächern
  await stack.click();
  const polaroid = modal.locator('.fanned-polaroid');
  await expect(polaroid).toBeVisible();

  // 3. Klick auf das Polaroid öffnet den Vorschau-Dialog (#364)
  await polaroid.click();

  const previewModal = page.getByRole('dialog', { name: 'ticket.png' });
  await expect(previewModal).toBeVisible();
  await expect(previewModal.locator('.preview-img')).toBeVisible();
  await expect(previewModal.getByRole('button', { name: 'Herunterladen' })).toBeVisible();
  await expect(previewModal.getByRole('button', { name: 'Löschen' })).toBeVisible();

  // Vorschau-Dialog schließen
  await previewModal.locator('.close-btn').click();
  await expect(previewModal).toHaveCount(0);

  // Anhang über das rote X-Badge am Polaroid entfernen
  await modal.locator('.remove-thumb').click();
  await expect(modal.locator('.fanned-polaroid')).toHaveCount(0);
});
