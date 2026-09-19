import { test, expect } from '@playwright/test';

// Regressionsnetz für die Entwurfs-Zwischenspeicherung (Nutzer-Feedback: ungespeicherte Eingaben
// sollen bei einem App-Absturz nicht verloren gehen) - composables/useDraftAutosave.ts,
// components/DraftStatusBar.vue, routes/drafts.ts. Notizen als Pilot-Domäne (wie schon bei
// attachments.spec.ts - einfachstes Formular, ein einziges Pflichtfeld), das Muster ist aber
// identisch in jeder anderen verdrahteten Domäne. Reload statt echtem Crash simuliert den
// Kern-Fall: Vue-State geht komplett verloren, nur was tatsächlich persistiert wurde (localStorage/
// Server) übersteht das. Inhalt-Feld ist seit der Umstellung auf den WYSIWYG-Editor
// (RichTextEditor.vue) ein contenteditable-Div statt einer <textarea> - Tippen per click()+
// pressSequentially() statt fill(), Wert-Vergleich per innerText statt toHaveValue().
test.describe('Entwurfs-Zwischenspeicherung für Formulare', () => {
  test('ein noch nicht abgeschickter neuer Text übersteht einen Reload und wird beim erneuten Öffnen wiederhergestellt', async ({
    page,
  }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Neue Notiz' }).click();
    const editor = page.locator('.modal .richtext-content[contenteditable="true"]');
    await editor.click();
    await editor.pressSequentially('Angefangener, noch nicht gespeicherter Text');

    // Debounce (600ms in useDraftAutosave.ts) abwarten, bis der Entwurf tatsächlich persistiert ist.
    await expect(page.locator('.draft-status')).toContainText('Entwurf gesichert', {
      timeout: 3_000,
    });

    await page.reload();
    await page.getByRole('button', { name: 'Neue Notiz' }).click();

    await expect(page.locator('.modal .richtext-content[contenteditable="true"]')).toHaveText(
      'Angefangener, noch nicht gespeicherter Text'
    );
    await expect(page.locator('.draft-status')).toContainText('Entwurf wiederhergestellt');

    // Aufräumen: explizites Schließen verwirft den Entwurf wieder (siehe closeForm()/newDraft.clear()
    // in NotesView.vue) - sonst bliebe er serverseitig (geteilte Test-DB über die ganze e2e-Suite
    // hinweg) für nachfolgende Tests bestehen.
    await page.locator('.modal .close-btn').click();
  });

  test('nach erfolgreichem Speichern bleibt kein Entwurf zurück', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Neue Notiz' }).click();
    const editor = page.locator('.modal .richtext-content[contenteditable="true"]');
    await editor.click();
    await editor.pressSequentially('Wird gleich richtig gespeichert');
    await expect(page.locator('.draft-status')).toContainText('Entwurf gesichert', {
      timeout: 3_000,
    });

    await page.locator('.add-form button[type="submit"]').click();
    await expect(
      page.locator('.note-card', { hasText: 'Wird gleich richtig gespeichert' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Neue Notiz' }).click();
    await expect(page.locator('.modal .richtext-content[contenteditable="true"]')).toHaveText('');
    await expect(page.locator('.draft-status')).toHaveCount(0);
  });

  test('eine ungespeicherte Änderung im Bearbeiten-Formular übersteht einen Reload', async ({
    page,
  }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: 'Neue Notiz' }).click();
    const newEditor = page.locator('.modal .richtext-content[contenteditable="true"]');
    await newEditor.click();
    await newEditor.pressSequentially('Ursprungstext der Notiz');
    await page.locator('.add-form button[type="submit"]').click();
    const card = page.locator('.note-card', { hasText: 'Ursprungstext der Notiz' });
    await expect(card).toBeVisible();

    await card
      .locator('.note-actions')
      .getByRole('button', { name: /bearbeiten/i })
      .click();
    const modal = page.locator('.modal', { hasText: 'Notiz bearbeiten' });
    const editEditor = modal.locator('.richtext-content[contenteditable="true"]');
    await editEditor.click();
    await editEditor.press('End');
    await editEditor.pressSequentially(' - gerade am Ändern');
    await expect(modal.locator('.draft-status')).toContainText('Entwurf gesichert', {
      timeout: 3_000,
    });

    await page.reload();
    await card
      .locator('.note-actions')
      .getByRole('button', { name: /bearbeiten/i })
      .click();
    await expect(modal.locator('.richtext-content[contenteditable="true"]')).toHaveText(
      'Ursprungstext der Notiz - gerade am Ändern'
    );
    await expect(modal.locator('.draft-status')).toContainText('Entwurf wiederhergestellt');
  });

  test('ein ungespeicherter Entwurf in der ToDo- und Einkaufsliste kann verworfen werden', async ({
    page,
  }) => {
    // ToDo-Liste
    await page.goto('/todo');
    const todoInput = page.locator('.add-form input[placeholder="Neue Aufgabe"]');
    await todoInput.click();
    await todoInput.fill('Wanderschuhe imprägnieren');
    await expect(page.locator('.add-form .draft-status')).toContainText('Entwurf gesichert', {
      timeout: 4_000,
    });
    await expect(page.locator('.add-form .draft-discard-btn')).toBeVisible();

    await page.locator('.add-form .draft-discard-btn').click();
    await expect(todoInput).toHaveValue('');
    await expect(page.locator('.add-form .draft-status')).toHaveCount(0);

    await page.reload();
    await expect(todoInput).toHaveValue('');
    await expect(page.locator('.add-form .draft-status')).toHaveCount(0);

    // Einkaufsliste
    await page.goto('/shopping');
    const shoppingInput = page.locator('.add-form input[placeholder="Neuer Artikel"]');
    await shoppingInput.click();
    await shoppingInput.fill('Sonnencreme LSF 50+');
    await expect(page.locator('.add-form .draft-status')).toContainText('Entwurf gesichert', {
      timeout: 4_000,
    });
    await expect(page.locator('.add-form .draft-discard-btn')).toBeVisible();

    await page.locator('.add-form .draft-discard-btn').click();
    await expect(shoppingInput).toHaveValue('');
    await expect(page.locator('.add-form .draft-status')).toHaveCount(0);

    await page.reload();
    await expect(shoppingInput).toHaveValue('');
    await expect(page.locator('.add-form .draft-status')).toHaveCount(0);
  });
});
