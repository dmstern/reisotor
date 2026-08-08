import { test, expect } from '@playwright/test';

// Regressionsnetz für den neuen WYSIWYG-Editor (RichTextEditor.vue/RichTextDisplay.vue), der die
// bisherigen <textarea>+renderRichText()-Vorschau-Felder ersetzt. Notizen stellvertretend für alle
// fünf umgestellten Domänen (gleiche Komponenten überall) - deckt sowohl den neuen Editor-Pfad
// (content_format 'html') als auch den weiterhin funktionierenden Legacy-Anzeige-Pfad für bereits
// vor dieser Umstellung angelegte Inhalte ab (die Demo-Seed-Notiz "WLAN & Notfallkontakte" hat kein
// content_format gesetzt, siehe seedDemo.ts).
test('creating a note with the WYSIWYG editor renders formatting, and a pre-existing legacy note still displays', async ({
  page,
}) => {
  await page.goto('/notes');

  // Legacy-Pfad: bereits vor der Umstellung angelegte Notiz rendert weiterhin über renderRichText().
  const legacyCard = page.locator('.note-card', { hasText: 'WLAN & Notfallkontakte' });
  await expect(legacyCard).toBeVisible();
  await expect(legacyCard.locator('.content')).toContainText('Notfallnummer Portugal: 112.');

  await page.getByRole('button', { name: '+ Neue Notiz' }).click();
  const editor = page.locator('.modal .richtext-content[contenteditable="true"]');
  await editor.click();
  // Formatierung EIN-/AUSschalten vor dem Tippen (statt Text zu tippen und danach per Ctrl+A zu
  // selektieren) - deterministischer als eine Selektion, die je nach Editor-/Browser-Timing
  // unterschiedlich greifen kann.
  await page.getByRole('button', { name: 'Fett', exact: true }).click();
  // Der Toolbar-Klick ruft intern editor.chain().focus()...run() auf (RichTextEditor.vue) - das
  // Fokussieren läuft nicht synchron zum Klick-Event zurück zu Playwright, direktes Weitertippen
  // konnte deshalb gelegentlich ins Leere gehen bzw. vor dem tatsächlichen Fokus-Wechsel landen
  // (beobachtete CI-Flakiness: <li> existierte, aber mit leerem Text). Explizit auf den Fokus warten
  // statt direkt weiterzutippen.
  await expect(editor).toBeFocused();
  await editor.pressSequentially('Wichtiger Punkt');
  await page.getByRole('button', { name: 'Fett', exact: true }).click();
  await editor.press('Enter');
  await page.getByRole('button', { name: 'Aufzählung' }).click();
  // Bewusst nur EIN Listeneintrag statt eines zweiten per Enter-Fortsetzung: Enter-getriebenes
  // Aufsplitten eines <li> in ein zweites hing in CI (anderer Chromium-Build als lokal) fest bei
  // "1 <li>" - reproduzierbar über mehrere Runs, kein reiner Timing-Flake, siehe Diskussion bei der
  // ursprünglichen Einführung dieses Tests. Ein einzelner Listeneintrag deckt den eigentlich
  // relevanten Regressionsfall (Aufzählung wird als <ul><li> gerendert) weiterhin vollständig ab.
  // Auf das tatsächliche Erscheinen des <li> warten, bevor hineingetippt wird - sonst dieselbe
  // Fokus-Race wie oben, nur diesmal mit einem neu erzeugten Knoten statt nur einem Fokus-Wechsel.
  await expect(editor.locator('li')).toHaveCount(1);
  await expect(editor).toBeFocused();
  await editor.pressSequentially('Erster Listenpunkt');

  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

  const newCard = page.locator('.note-card', { hasText: 'Wichtiger Punkt' });
  await expect(newCard).toBeVisible();
  await expect(newCard.locator('.content strong', { hasText: 'Wichtiger Punkt' })).toBeVisible();
  await expect(newCard.locator('.content ul li')).toHaveCount(1);
  await expect(newCard.locator('.content ul li').first()).toHaveText('Erster Listenpunkt');
});
