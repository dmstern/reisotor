import { test, expect } from '@playwright/test';

// Regressionsnetz für die Todo-Checkbox im Kalender (ScheduleView.vue's Tages-Detailliste,
// ersetzt das bisherige 📋-Emoji): Abhaken im Kalender muss denselben done-Status setzen wie das
// Abhaken in TodoView.vue selbst (beide rufen letztlich PUT /todos/:id).
test('checking off a todo in the calendar day view marks it done in TodoView.vue too', async ({ page }) => {
  const todayIso = new Date().toISOString().slice(0, 10);

  await page.goto('/todo');
  await page.getByPlaceholder('Neue Aufgabe').fill('E2E Kalender-Checkbox-Test');
  await page.locator('input[type="date"]').first().fill(todayIso);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.locator('.row', { hasText: 'E2E Kalender-Checkbox-Test' })).toBeVisible();

  await page.goto('/');
  await page.locator(`.day[data-date="${todayIso}"]`).click();

  const calendarItem = page.locator('.day-detail .items .item', { hasText: 'E2E Kalender-Checkbox-Test' });
  await expect(calendarItem).toBeVisible();
  const checkbox = calendarItem.locator('input[type="checkbox"]');
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  await page.goto('/todo');
  const todoRow = page.locator('.row', { hasText: 'E2E Kalender-Checkbox-Test' });
  await expect(todoRow).toHaveClass(/row-done/);
  await expect(todoRow.locator('input[type="checkbox"]')).toBeChecked();
});
