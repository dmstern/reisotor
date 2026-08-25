import { test, expect } from '@playwright/test';

// Regressionsnetz für einen vom Nutzer gemeldeten Punkt: "Einplanen" (Kalender) und "Als gemacht
// markieren" ergaben für eine Unterkunft (kein Ausflugsziel, das man "besucht"/einplant) keinen
// Sinn und wurden entfernt - sowohl in der Spots-Übersicht (SpotCard.vue) als auch im Detail-Dialog
// (SpotDetailDialog.vue, von dort wiederverwendet u. a. in ExcursionDetailDialog.vue/TripMap.vue).
// Die Möglichkeit, eine Unterkunft einer Tour zuzuordnen, bleibt bewusst erhalten (eine Unterkunft
// kann sinnvoll Station einer Tour sein) - seit #106 über das "Tour zuordnen"-Dropdown
// (TourAssignDropdown.vue) statt des früheren "Auf Tour ziehen"-Anfassers, der in der
// Kategorie-Gruppierung (Standardansicht, kein Wechsel auf die Touren-Gruppierung in diesem Test)
// entfallen ist, da dort keine Tour-Karten mehr als Ablageziele sichtbar sind.
//
// Der ebenfalls gemeldete Dashboard-Bug ("Noch nichts eingetragen" trotz eingetragener, nur bereits
// vergangener Unterkunft) ist bewusst nicht hier als E2E-Test abgedeckt: die dafür nötige
// Test-Bedingung (KEINE Unterkunft mit aktuellem/zukünftigem Zeitraum) ließe sich nur durch Ändern
// der von anderen Specs mitgenutzten Demo-Unterkunft "Hotel Alfama" herstellen - der Fix selbst ist
// eine einzeilige Ergänzung, die exakt das bereits bestehende, getestete Muster der Reise-Kachel
// direkt daneben wiederverwendet (siehe DashboardView.vue).
test.describe('Unterkunft-Spot: Aktionen, die für eine Unterkunft keinen Sinn ergeben', () => {
  test('"Einplanen" und "Als gemacht markieren" fehlen, "Tour zuordnen" bleibt', async ({
    page,
  }) => {
    const title = `Testunterkunft ${Date.now()}`;

    await page.goto('/excursions');
    await page.getByRole('button', { name: 'Neuer Spot' }).click();
    const modal = page.locator('.modal', { hasText: 'Neuer Spot' });
    await modal.getByPlaceholder('Titel').fill(title);
    await modal
      .getByPlaceholder('Kategorie (optional, z. B. Restaurant – oder eigene erstellen)')
      .fill('Unterkunft');
    await modal.locator('button[type="submit"]', { hasText: 'Hinzufügen' }).click();
    await expect(page.locator('.spot-card', { hasText: title }).first()).toBeVisible();

    const spotCard = page.locator('.spot-card', { hasText: title }).first();
    await spotCard.click();
    const actions = spotCard.locator('.card-actions');
    await expect(actions).toContainText('Tour zuordnen');
    await expect(actions).not.toContainText('Einplanen');
    await expect(actions).not.toContainText('Als gemacht markieren');
  });
});
