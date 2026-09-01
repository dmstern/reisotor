import type { Page } from '@playwright/test';

/** Vor jedem `page.goto()` in einer Wegwerf-Spec aufrufen, die anschließend einen Screenshot macht
 *  (#197): style.css setzt für Fira Sans bewusst `font-display: optional` (siehe dortiger
 *  Kommentar). In einem frischen, headless Playwright-Kontext committet Chromium den allerersten
 *  Seitenaufruf damit praktisch IMMER dauerhaft auf die Fallback-Schrift — auch wenn die Font-Datei
 *  rechtzeitig eintrifft und `document.fonts` sie danach als "loaded" meldet. `optional` sieht per
 *  Spec keinen Swap-Zeitraum vor: einmal für die Fallback-Schrift entschieden, wird bereits gemalter
 *  Text nicht mehr neu gezeichnet, auch nicht durch ein explizites `document.fonts.load()`/`.ready`
 *  danach (mehrfach isoliert verifiziert, siehe PR #203) oder durch `page.reload()` (derselbe
 *  Browser-Prozess trifft dieselbe "optional"-Entscheidung erneut). Einzig verlässlicher Weg: den
 *  `font-display`-Wert der an DIESEN Browser ausgelieferten style.css für die Dauer des Tests durch
 *  Response-Rewriting auf `block` umschreiben — Chromium wartet dann bis zu 3s auf den Font, bevor
 *  es auf die Fallback-Schrift ausweicht, und rendert danach zuverlässig mit Fira Sans.
 *  Production-Verhalten (bzw. der Kommentar dort zum bewussten `optional`) bleibt unangetastet. */
export async function forceFontDisplayBlock(page: Page): Promise<void> {
  await page.route('**/style.css', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: body.replace(/font-display:\s*optional/g, 'font-display: block'),
    });
  });
}

/** Stellt in E2E- und Scratch-Tests sicher, dass der Splash-Screen (#splash und .splash) vollständig
 *  ausgeblendet/entfernt ist und die eigentliche Benutzeroberfläche (.page / .app-shell) sichtbar ist,
 *  bevor Screenshots aufgenommen werden. */
export async function waitForAppReady(page: Page): Promise<void> {
  await page
    .locator('#splash')
    .waitFor({ state: 'detached', timeout: 10_000 })
    .catch(() => {});
  await page
    .locator('.splash')
    .waitFor({ state: 'detached', timeout: 10_000 })
    .catch(() => {});
  await page
    .locator('.loading-state')
    .waitFor({ state: 'detached', timeout: 10_000 })
    .catch(() => {});
  await page
    .locator('.app-main, .budget-page, .dashboard, .page')
    .first()
    .waitFor({ state: 'attached', timeout: 10_000 });
  await page.waitForTimeout(500);
}
