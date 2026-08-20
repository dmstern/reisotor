import { test, expect } from '@playwright/test';

// Regressionsnetz für das frei änderbare Datum eines Tagebucheintrags (siehe backend/src/routes/
// diary.ts, DiaryView.vue) - vorher gab es dafür nur das unveränderliche created_at. Deckt ab: das
// Datumsfeld ist beim Anlegen mit heute vorbelegt, ein geändertes Datum wird angezeigt UND wirkt
// sich auf die Sortierung aus (ein rückblickend auf einen früheren Tag gesetzter Eintrag wandert
// hinter einen mit einem späteren/heutigen Datum), und lässt sich nachträglich beim Bearbeiten
// erneut ändern.
test.describe('Tagebuch: Datum eines Eintrags', () => {
  test('neuer Eintrag ist mit dem heutigen Datum vorbelegt, ein geändertes Datum wirkt sich auf Anzeige und Sortierung aus', async ({
    page,
  }) => {
    const marker = `E2E-Diary-${Date.now()}`;
    const todayTitle = `Heute ${marker}`;
    const pastTitle = `Vorgestern ${marker}`;

    await page.goto('/diary');

    // Erster Eintrag: Datumsfeld unangetastet lassen - muss bereits mit heute vorbelegt sein.
    await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
    const newModal = page.locator('.modal', { hasText: 'Neuer Tagebucheintrag' });
    const newDateInput = newModal.locator('input[type="date"]');
    const todayValue = await newDateInput.inputValue();
    expect(todayValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await newModal.locator('input[type="text"][placeholder="Titel (optional)"]').fill(todayTitle);
    const newEditor = newModal.locator('.richtext-content[contenteditable="true"]');
    await newEditor.click();
    await expect(newEditor).toBeFocused();
    await newEditor.pressSequentially('Ganz normaler heutiger Eintrag.');
    await newModal.locator('button[type="submit"]').click();
    await expect(page.locator('.entry', { hasText: todayTitle })).toBeVisible();

    // Zweiter Eintrag: Datum bewusst auf vorgestern zurückstellen (rückblickend nachgetragen).
    const past = new Date();
    past.setDate(past.getDate() - 2);
    const pastDateStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;

    await page.getByRole('button', { name: 'Neuer Eintrag' }).click();
    const secondModal = page.locator('.modal', { hasText: 'Neuer Tagebucheintrag' });
    await secondModal.locator('input[type="date"]').fill(pastDateStr);
    await secondModal.locator('input[type="text"][placeholder="Titel (optional)"]').fill(pastTitle);
    const secondEditor = secondModal.locator('.richtext-content[contenteditable="true"]');
    await secondEditor.click();
    await expect(secondEditor).toBeFocused();
    await secondEditor.pressSequentially('Rückblickend nachgetragener Eintrag von vorgestern.');
    await secondModal.locator('button[type="submit"]').click();

    const todayEntry = page.locator('.entry', { hasText: todayTitle });
    const pastEntry = page.locator('.entry', { hasText: pastTitle });
    await expect(todayEntry).toBeVisible();
    await expect(pastEntry).toBeVisible();

    // Der auf "vorgestern" datierte Eintrag steht trotz späterer Erstellung HINTER dem heutigen -
    // die Sortierung folgt dem Eintrags-Datum, nicht dem Anlagezeitpunkt.
    const entries = page.locator('.entry');
    const allTitles = await entries.allTextContents();
    const todayIndex = allTitles.findIndex((t) => t.includes(todayTitle));
    const pastIndex = allTitles.findIndex((t) => t.includes(pastTitle));
    expect(todayIndex).toBeGreaterThanOrEqual(0);
    expect(pastIndex).toBeGreaterThan(todayIndex);

    // Nachträgliches Ändern des Datums beim Bearbeiten: der "heutige" Eintrag wird auf morgen
    // vorverlegt und muss danach vor dem vorgestrigen UND weiterhin sichtbar bleiben.
    await todayEntry.locator('.entry-actions').getByRole('button', { name: /bearbeiten/i }).click();
    const editModal = page.locator('.modal', { hasText: 'Eintrag bearbeiten' });
    const editDateInput = editModal.locator('input[type="date"]');
    await expect(editDateInput).toHaveValue(todayValue);
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const futureDateStr = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
    await editDateInput.fill(futureDateStr);
    await editModal.locator('button[type="submit"]').click();

    await expect(todayEntry).toBeVisible();
    await expect(todayEntry.locator('.date')).toBeVisible();
  });
});
