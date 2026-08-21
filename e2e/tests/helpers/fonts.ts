import type { Page } from '@playwright/test';

/** Alle in frontend/src/style.css deklarierten Fira-Sans-Schnitte (Familie/Stil/Gewicht) — muss bei
 *  neuen Schnitten dort mitgepflegt werden. */
const FONT_SPECS = [
  '400 16px "Fira Sans"',
  'italic 400 16px "Fira Sans"',
  '500 16px "Fira Sans"',
  '600 16px "Fira Sans"',
  '700 16px "Fira Sans"',
  'italic 500 16px "Fira Sans"',
  'italic 600 16px "Fira Sans"',
  'italic 700 16px "Fira Sans"',
];

/** Vor jedem `page.screenshot()` aufrufen (#197): style.css setzt für Fira Sans bewusst
 *  `font-display: optional` (siehe dortiger Kommentar) — in einem frischen Playwright-Kontext ohne
 *  warmen HTTP-Cache verpasst der Download der Font-Datei damit fast immer das sehr kurze
 *  "block period" dieses Modus, wodurch der Browser für die GESAMTE Seite dauerhaft bei der
 *  Fallback-Schrift bleibt, statt später auf Fira Sans umzuschalten — sichtbar als abweichende
 *  Schriftart nur in Playwright-Screenshots, nie im echten (Font bereits gecachten) Browser.
 *  `document.fonts.load()` umgeht dieses Timing, indem es den Font-Ladevorgang explizit anstößt und
 *  abwartet; anders als der reine `font-display`-Mechanismus rendert der Browser dadurch bereits
 *  vorhandenen Text anschließend mit dem geladenen Font neu. */
export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async (specs) => {
    await Promise.all(specs.map((spec) => document.fonts.load(spec)));
    await document.fonts.ready;
  }, FONT_SPECS);
}
