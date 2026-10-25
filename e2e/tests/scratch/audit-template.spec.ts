import { test, expect } from '@playwright/test';
import { forceFontDisplayBlock, waitForAppReady, waitForMapTiles } from '../helpers/fonts.js';
import {
  expectNoHorizontalOverflow,
  setCalendarDrawerOpen,
  setCalendarDrawerWidth,
  getAppMainContentWidth,
  VIEWPORTS,
} from '../helpers/layout.js';

/**
 * ADVERSARIAL LAYOUT AUDIT TEMPLATE
 *
 * Verwende diese Vorlage für fokussierte UI/Layout-Audits nach Refactorings oder Änderungen.
 * Stresstestet die Zielseite auf kritischen Viewports und Drawer-Zuständen:
 *  - 320x568 (Narrow Mobile: iPhone SE, extrem schmale Bildschirme)
 *  - 390x844 (Mobile: Standard Smartphone)
 *  - 1080x900 (Narrow Desktop: Desktop-Schwelle mit reduzierter Inhaltsbreite bei offener Schublade)
 *  - 1280x800 (Desktop: Standard Laptop)
 *
 * Ausführung:
 *   cd e2e && npx -y playwright test tests/scratch/audit-template.spec.ts
 *
 * Für eine spezifische Route:
 *   AUDIT_ROUTE=/trip/1/spots cd e2e && npx -y playwright test tests/scratch/audit-template.spec.ts
 */

const targetRoute = process.env.AUDIT_ROUTE ?? '/trip/1';

test.describe(`Adversarial Layout Audit: ${targetRoute}`, () => {
  // Mobile Viewports (ohne Desktop-Drawer)
  const mobileViewports = [
    { name: 'narrowMobile-320', ...VIEWPORTS.narrowMobile },
    { name: 'mobile-390', ...VIEWPORTS.mobile },
  ];

  for (const vp of mobileViewports) {
    test(`Mobile Viewport ${vp.name} (${vp.width}x${vp.height}): kein horizontaler Overflow`, async ({
      page,
    }) => {
      await forceFontDisplayBlock(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(targetRoute);
      await waitForAppReady(page);
      await waitForMapTiles(page);

      // 1. Mathematische Layout-Integrität: Kein Element darf seitlich ausbrechen
      await expectNoHorizontalOverflow(page);

      // 2. Sichtbarkeits-Check: Hauptcontainer muss vorhanden und sichtbar sein
      const mainContainer = page
        .locator('.page, .app-main, .dashboard, .budget-page, .landing')
        .first();
      await expect(mainContainer).toBeVisible();

      // 3. Tab-Matrix: Falls Tabs vorhanden sind (z. B. TabBar in ListenView oder SettingsView), jeden Reiter durchschalten
      const tabs = page.locator('.tab-bar [role="tab"], .tab-bar button.tab');
      const tabCount = await tabs.count();
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible()) {
          await tab.click();
          await page.waitForTimeout(100);
          await expectNoHorizontalOverflow(page);
        }
      }

      // 4. Details / Accordion Matrix: Einklappbare Details öffnen und auf Overflow prüfen
      const details = page.locator('details:not([open]) summary');
      const detailsCount = await details.count();
      for (let i = 0; i < Math.min(detailsCount, 3); i++) {
        const summary = details.nth(i);
        if (await summary.isVisible()) {
          await summary.click();
          await page.waitForTimeout(50);
          await expectNoHorizontalOverflow(page);
        }
      }

      if (process.env.AUDIT_SCREENSHOTS) {
        await page.screenshot({ path: `tests/scratch/audit-${vp.name}.png`, fullPage: false });
      }
    });
  }

  // Desktop Viewports mit Drawer-Matrix (Kalenderschublade offen vs. geschlossen)
  const desktopViewports = [
    { name: 'narrowDesktop-1080', ...VIEWPORTS.narrowDesktop },
    { name: 'desktop-1280', ...VIEWPORTS.desktop },
  ];

  for (const vp of desktopViewports) {
    test(`Desktop Viewport ${vp.name} (${vp.width}x${vp.height}): Drawer offen vs. geschlossen & stufenlose Breite`, async ({
      page,
    }) => {
      await forceFontDisplayBlock(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(targetRoute);
      await waitForAppReady(page);
      await waitForMapTiles(page);

      // Zustand 1: Schublade geöffnet (Default auf Desktop)
      await setCalendarDrawerOpen(page, true);
      await expectNoHorizontalOverflow(page);
      if (process.env.AUDIT_SCREENSHOTS) {
        await waitForMapTiles(page);
        await page.screenshot({
          path: `tests/scratch/audit-${vp.name}-drawer-open.png`,
          fullPage: false,
        });
      }
      const widthOpen = await getAppMainContentWidth(page);

      // Zustand 2: Stufenlose Maximalbreite / Enge-Stresstest (Schublade breit ziehen)
      if ((await page.locator('.drawer.left').count()) > 0) {
        await setCalendarDrawerWidth(page, 500);
        await expectNoHorizontalOverflow(page);
        if (process.env.AUDIT_SCREENSHOTS) {
          await waitForMapTiles(page);
          await page.screenshot({
            path: `tests/scratch/audit-${vp.name}-drawer-500px.png`,
            fullPage: false,
          });
        }
      }

      // Zustand 3: Schublade geschlossen (volle Inhaltsbreite)
      await setCalendarDrawerOpen(page, false);
      await expectNoHorizontalOverflow(page);
      if (process.env.AUDIT_SCREENSHOTS) {
        await waitForMapTiles(page);
        await page.screenshot({
          path: `tests/scratch/audit-${vp.name}-drawer-closed.png`,
          fullPage: false,
        });
      }
      const widthClosed = await getAppMainContentWidth(page);

      // Verifikation: Geschlossen muss der .app-main Container breiter sein als geöffnet
      if ((await page.locator('.drawer.left').count()) > 0) {
        expect(widthClosed).toBeGreaterThan(widthOpen);
      }
    });
  }
});
