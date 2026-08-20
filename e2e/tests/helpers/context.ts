import type { Browser, BrowserContextOptions } from '@playwright/test';

/** browser.newContext() (manuell aufgerufen, für Mehr-Nutzer-/Mehr-Tab-Szenarien) übernimmt NICHT
 *  automatisch playwright.config.ts's use.reducedMotion - anders als z. B. storageState gilt das
 *  nur für die eingebauten context/page-Fixtures. Ohne diesen Helper spielt der Splash-Screen
 *  (SplashScreen.vue/ReisotorRobot.vue's "packing"-Phase, #149) bei jedem frischen Login/Reload in
 *  so einem manuellen Kontext die volle ~2s-Rucksack-Animation statt der für reduced-motion
 *  verkürzten Variante ab - bei Tests mit mehreren Logins/Reloads (budget.spec.ts,
 *  realtime-sync.spec.ts, ...) genug zusätzliche Zeit, um knappe .toPass()-Timeouts reißen zu
 *  lassen. Immer diesen Helper statt browser.newContext() direkt verwenden, wenn ein Test einen
 *  unabhängigen (nicht die Standard-storageState-Session teilenden) Kontext braucht. */
export function newContextWithReducedMotion(browser: Browser, options: BrowserContextOptions = {}) {
  return browser.newContext({ reducedMotion: 'reduce', ...options });
}
