import { test, expect } from '@playwright/test';

// Regressionstest für FileAttachments.vue's editable-Prop (Nutzer-Feedback: der Datei-Upload-Button
// war fälschlich auch im reinen Ansichts-/Detail-Modus von Objekten sichtbar, nicht nur beim
// Bearbeiten). Notizen als Beispiel-Domäne (siehe attachments.spec.ts für die Begründung) - die
// Karten-Ansicht ist der reine Anzeigemodus, das "Notiz bearbeiten"-Formular der Bearbeiten-Modus.
test('Datei-Upload-Button erscheint nur im Bearbeiten-Formular, nicht in der Karten-Ansicht', async ({
  page,
}) => {
  await page.goto('/notes');
  await page.getByRole('button', { name: 'Neue Notiz' }).click();
  const editor = page.locator('.modal .richtext-content[contenteditable="true"]');
  await editor.click();
  await editor.pressSequentially('E2E Ansichtsmodus-Test-Notiz');
  await page.locator('.add-form button[type="submit"]').click();

  const card = page.locator('.note-card', { hasText: 'E2E Ansichtsmodus-Test-Notiz' });
  await expect(card).toBeVisible();

  // Ansichtsmodus (Karte): kein Upload-Button, da noch kein Anhang existiert bleibt der ganze
  // Anhänge-Bereich komplett weg (siehe FileAttachments.vue's editable-Fallback).
  await expect(card.locator('.upload-label')).toHaveCount(0);
  await expect(card.locator('.file-attachments')).toHaveCount(0);

  // Bearbeiten-Modus: Upload-Button ist da.
  await card
    .locator('.note-actions')
    .getByRole('button', { name: /bearbeiten/i })
    .click();
  const modal = page.locator('.modal', { hasText: 'Notiz bearbeiten' });
  await expect(modal.locator('.upload-label')).toBeVisible();
});
