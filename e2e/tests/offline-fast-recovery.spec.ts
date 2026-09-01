import { test, expect } from '@playwright/test';

// Regressionstest für einen vom Nutzer gemeldeten Bug: nachdem einmal ein echter Netzfehler
// festgestellt wurde, wartete JEDER weitere Request in derselben Sitzung erneut den vollen
// REQUEST_TIMEOUT_MS (8s) ab, bevor er auf den Cache zurückfiel - jede View, jeder Klick fühlte sich
// dadurch "hängend" an, obwohl längst klar war, dass der Server nicht erreichbar ist. Fix:
// isConfirmedOffline()-Flag (api/offline.ts), von api/client.ts gesetzt und erst von
// stores/connectivity.ts's Health-Check wieder zurückgesetzt.
test.describe('Offline-Erkennung merkt sich einen Fehlschlag statt jedes Mal neu zu warten', () => {
  test('zweite View lädt nach einem ersten Fehlschlag sofort aus dem Cache statt erneut den Timeout abzuwarten', async ({
    page,
  }) => {
    await page.goto('/listen?tab=todo');
    await expect(page.locator('.todo-page')).toBeVisible();
    // Zweite View schon einmal online besuchen, damit ihr Cache-Eintrag existiert - der eigentliche
    // Test soll nur die Geschwindigkeit des ZWEITEN (bereits als offline bekannten) Requests prüfen,
    // nicht einen echten Cache-Miss. Per Tab-Klick statt page.goto(), siehe Kommentar unten.
    await page.getByRole('tab', { name: 'Packliste' }).click();
    await expect(page.locator('.packing-page')).toBeVisible();

    // Alle API-Requests hängen ab jetzt für immer (nie fulfill/abort) - simuliert das gemeldete
    // Szenario "Netz da, Server antwortet aber nie" statt eines sauberen, sofortigen Fehlschlags.
    await page.route('**/api/**', () => {});

    // WICHTIG: ab hier per Klick auf den Tab statt page.goto() - Letzteres löst einen echten
    // Browser-Neuladevorgang aus (neuer JS-Kontext), was auch isConfirmedOffline() (api/offline.ts) -
    // ein bewusst simples, nicht in localStorage persistiertes Modul-Flag - auf seinen Ausgangswert
    // zurücksetzen würde. Im echten Nutzungsfall navigiert man innerhalb der SPA (vue-router,
    // clientseitig, kein Neuladen) - genau das bildet ein Klick hier ab, ein erneutes page.goto()
    // würde ein Szenario testen, das so in der App gar nicht vorkommt. Packliste/ToDo sind seit dem
    // "Listen"-Merge Tabs derselben Route statt eigener Nav-Links (siehe ListenView.vue), ein
    // Tab-Klick ist ebenso rein clientseitig wie vorher der Nav-Link-Klick.
    await page.getByRole('tab', { name: 'ToDo' }).click();
    const todoStart = Date.now();
    await expect(page.locator('.todo-page')).toBeVisible({ timeout: 12_000 });
    expect(Date.now() - todoStart).toBeGreaterThan(6_000); // erster Fehlschlag wartet noch den vollen Timeout ab

    const packingStart = Date.now();
    await page.getByRole('tab', { name: 'Packliste' }).click();
    await expect(page.locator('.packing-page')).toBeVisible({ timeout: 3_000 });
    // Der zweite Request (anderer Endpunkt, aber derselbe bereits als offline bekannte Zustand) darf
    // nicht erneut den Timeout abwarten müssen.
    expect(Date.now() - packingStart).toBeLessThan(3_000);
  });

  test('Klick auf das Offline-Symbol im Header erkennt eine Wiederverbindung sofort statt auf den nächsten Health-Check zu warten', async ({
    page,
  }) => {
    await page.goto('/todo');
    await expect(page.locator('.todo-page')).toBeVisible();

    await page.route('**/api/**', (route) => route.abort());
    // Der periodische Health-Check (alle 6s, siehe stores/connectivity.ts) erkennt den Ausfall auch
    // ohne eigenes Zutun - etwas großzügiger Timeout, da CI-Runner langsamer sein können.
    await expect(page.locator('.offline-badge')).toBeVisible({ timeout: 15_000 });

    await page.unroute('**/api/**');
    const retryStart = Date.now();
    await page.locator('.profile-link').click(); // Zu den Einstellungen
    await expect(page.locator('h1', { hasText: 'Einstellungen' })).toBeVisible();
    await page.locator('.retry-btn').click();
    await expect(page.locator('.offline-badge')).toHaveCount(0, { timeout: 3_000 });
    // Muss deutlich schneller sein als das nächste reguläre Health-Check-Intervall (6s) - genau der
    // Sinn des manuellen Retry-Buttons.
    expect(Date.now() - retryStart).toBeLessThan(3_000);
  });
});
