import { test, expect } from '@playwright/test';

// Regressionsnetz für die Offline-Anlage/-Bearbeitung neuer Objekte (siehe CLAUDE.md's
// "Offline-Fähigkeit" -> Daten-Ebene): ein offline angelegtes ToDo muss (a) sofort sichtbar werden,
// als "nur lokal gespeichert" markiert sein (PendingSyncBadge.vue), (b) einen Seiten-Reload
// überleben, bevor die Outbox (api/offline.ts) wieder gesendet werden konnte, und (c) nach
// Wiederverbindung automatisch mit dem Server synchronisiert werden (Markierung verschwindet).
test.describe('Offline angelegte Objekte werden als "nur lokal" markiert und später synchronisiert', () => {
  test('ein offline angelegtes ToDo übersteht einen Reload und synct sich nach Wiederverbindung', async ({
    page,
  }) => {
    await page.goto('/todo');
    await expect(page.locator('.todo-page')).toBeVisible();

    // Alle Backend-Requests schlagen künftig fehl (route.abort() -> fetch wirft TypeError, siehe
    // api/client.ts's isNetworkFailure()) - Matcher-Funktion statt eines '**/api/**'-Globs (wie in
    // offline-fast-recovery.spec.ts), weil dieser Test (anders als dort) einen echten
    // page.reload() macht: der Vite-Dev-Server liefert unbundelte Module u. a. von
    // '/src/api/client.ts' aus - ein reines Glob würde dessen Pfad fälschlich auch als "/api/"
    // matchen und den Modul-Import selbst blockieren, wodurch die App gar nicht erst bootet.
    // Dieselbe Funktionsreferenz wird unten an unroute() übergeben - page.unroute() entfernt sonst
    // nichts, da zwei separat erzeugte Arrow-Functions als unterschiedliche Matcher gelten.
    const isApiRequest = (url: URL) => url.pathname.startsWith('/api/');
    await page.route(isApiRequest, (route) => route.abort());
    await expect(page.locator('.offline-badge')).toBeVisible({ timeout: 15_000 });

    const title = `Offline-Sync-Test-${Date.now()}`;
    await page.getByPlaceholder('Neue Aufgabe').fill(title);
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();

    const row = page.locator('.row', { hasText: title });
    await expect(row).toBeVisible();
    await expect(row.locator('.pending-sync-badge')).toBeVisible();

    // Reload während weiterhin "offline" (Route bleibt aktiv, GET fällt auf den lokalen Cache
    // zurück, siehe api/client.ts) - das neu angelegte, noch nicht synchronisierte ToDo darf dabei
    // nicht aus der Liste verschwinden (siehe api/offline.ts's mergePendingIntoList).
    await page.reload();
    await expect(page.locator('.todo-page')).toBeVisible();
    const rowAfterReload = page.locator('.row', { hasText: title });
    await expect(rowAfterReload).toBeVisible();
    await expect(rowAfterReload.locator('.pending-sync-badge')).toBeVisible();

    // Wieder "online": Route freigeben, manueller Retry über die Einstellungen stößt den
    // Sync sofort an statt auf den nächsten periodischen Health-Check zu warten.
    await page.unroute(isApiRequest);
    await page.locator('.profile-link').click(); // Zu den Einstellungen
    await expect(page.locator('.settings-page')).toBeVisible();
    await page.locator('.retry-btn').click();
    await page.goBack();

    await expect(page.locator('.offline-badge')).toHaveCount(0, { timeout: 5_000 });
    await expect(rowAfterReload.locator('.pending-sync-badge')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('.row', { hasText: title })).toBeVisible();
  });
});
