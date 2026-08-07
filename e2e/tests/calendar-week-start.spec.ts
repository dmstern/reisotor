import { test, expect } from '@playwright/test';

// Regressionstest für zwei zusammenhängende, per Nutzer-Feedback gemeldete Bugs im Kalender-
// Monatsraster (ScheduleView.vue's monthWeeks, utils/dateFormat.ts's startOfWeek()):
//
// 1. Der Wochenanfang der Monatsansicht wich von der Profil-Einstellung "Wochenanfang" ab (immer
//    ein Tag zu früh) - Ursache war NICHT startOfWeek() selbst (das war schon korrekt), sondern
//    ScheduleView.vue's toIso()/todayStr(), die `date.toISOString().slice(0, 10)` nutzten. Das
//    rechnet über UTC um und verschiebt den Kalendertag in jeder Zeitzone östlich von UTC einen Teil
//    des Tages lang fälschlich auf den Vortag.
// 2. Als Symptom davon: die "heute"-Hervorhebung landete früh am lokalen Tag auf dem falschen
//    (Vor-)Tag. Simuliert über eine fest verankerte Uhrzeit (page.clock) kurz nach lokaler
//    Mitternacht in einer Zeitzone östlich von UTC (Europe/Berlin), wo der Bug greifbar wurde.
test.use({ timezoneId: 'Europe/Berlin' });

// Der geteilte storageState (auth.setup.ts) kann die Kalender-Schublade bereits offen hinterlassen
// (z. B. aus einem vorherigen Testlauf) - ein blindes .click() auf die Lasche würde sie dann
// stattdessen wieder SCHLIESSEN. aria-expanded prüfen statt anzunehmen, dass sie geschlossen startet.
async function openCalendarDrawer(page: import('@playwright/test').Page) {
  const tab = page.locator('.drawer-tab[aria-label*="Kalender"]');
  if ((await tab.count()) > 0 && (await tab.getAttribute('aria-expanded')) === 'false') {
    await tab.click();
  }
}

test.describe('Kalender-Monatsraster: Wochenanfang + "heute"-Hervorhebung', () => {
  test('Monatsraster beginnt mit Montag (Standard-Einstellung)', async ({ page }) => {
    await page.goto('/');
    await openCalendarDrawer(page);
    await expect(page.locator('.week').first()).toBeVisible();

    const firstDayWeekday = await page.locator('.week').first().locator('.day').first().locator('.weekday').textContent();
    expect(firstDayWeekday?.trim()).toBe('Mo');
  });

  test('Monatsraster beginnt mit Sonntag, wenn so eingestellt', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('reisotor-week-start', 'sunday'));
    await page.reload();
    await openCalendarDrawer(page);
    await expect(page.locator('.week').first()).toBeVisible();

    const firstDayWeekday = await page.locator('.week').first().locator('.day').first().locator('.weekday').textContent();
    expect(firstDayWeekday?.trim()).toBe('So');
  });

  test('"heute" wird auch kurz nach lokaler Mitternacht auf dem richtigen Tag hervorgehoben', async ({ page }) => {
    // 2026-08-06T22:30:00Z = 2026-08-07 00:30 Uhr Europe/Berlin (CEST, UTC+2) - bewusst kurz nach
    // lokaler Mitternacht, dem Zeitfenster, in dem der toISOString()-Bug zuschlug.
    await page.clock.install({ time: new Date('2026-08-06T22:30:00Z') });
    await page.goto('/');
    await openCalendarDrawer(page);
    await expect(page.locator('.week').first()).toBeVisible();

    await expect(page.locator('.day.today')).toHaveAttribute('data-date', '2026-08-07');
  });
});
