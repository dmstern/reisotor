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
  await page.route('**/*.css', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: body.replace(/font-display:\s*(?:optional|swap)/g, 'font-display: block'),
    });
  });
}

/** Stellt in E2E- und Scratch-Tests sicher, dass der Splash-Screen (#splash und .splash) vollständig
 *  ausgeblendet/entfernt ist und die eigentliche Benutzeroberfläche (.page / .app-shell) sichtbar ist,
 *  bevor Screenshots aufgenommen werden. */
export async function waitForAppReady(page: Page): Promise<void> {
  await page
    .locator('#splash, .splash')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => {});
  await page
    .locator('.page, .listen-view, .login-page, .landing, .calendar-drawer-content')
    .first()
    .waitFor({ state: 'attached', timeout: 15_000 });
  await page
    .locator('.loading-state, .view-loading')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** Stellt sicher, dass Leaflet-Kartenkacheln (OpenStreetMap) vollständig geladen und gerendert sind,
 *  bevor Screenshots aufgenommen werden. Verhindert weiße/unvollständige Kacheln im Screenshot. */
export async function waitForMapTiles(page: Page, timeoutMs = 20_000): Promise<void> {
  const isMapExpected =
    page.url().includes('/excursions') ||
    (await page
      .locator(
        '.trip-map-container:visible, .trip-map:visible, .leaflet-container:visible, .map-col:visible, .location-picker-map:visible, .mini-map:visible, .excursion-mini-map:visible, .map-wrap:visible'
      )
      .count()) > 0;

  if (!isMapExpected) {
    return;
  }

  // 1. Warten, bis ein sichtbarer Leaflet-Kartencontainer mit Abmessungen > 0 im DOM gerendert ist
  await page
    .waitForFunction(
      () => {
        const containers = Array.from(document.querySelectorAll<HTMLElement>('.leaflet-container'));
        return containers.some((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });
      },
      undefined,
      { timeout: 10_000 }
    )
    .catch(() => {});

  // 1b. In Screenshot-/Test-Umgebungen (insbes. bei eingefrorener Uhr per page.clock.setFixedTime)
  // stellt dieser Style sicher, dass fertig geladene Leaflet-Kacheln nicht in Leaflets JS-Fade-Loop (opacity: 0)
  // hängenbleiben, sondern sofort mit voller Deckkraft (opacity: 1) dargestellt werden.
  await page
    .addStyleTag({
      content: `
        .leaflet-tile.leaflet-tile-loaded {
          opacity: 1 !important;
          transition: none !important;
        }
      `,
    })
    .catch(() => {});

  // Bei Viewport- oder Schubladen-Änderungen sicherstellen, dass Leaflet die Kachelberechnung triggert
  await page.evaluate(() => {
    window.dispatchEvent(new Event('resize'));
    document.querySelectorAll<HTMLElement>('.leaflet-tile.leaflet-tile-loaded').forEach((el) => {
      el.style.opacity = '1';
    });
  });

  // 2. Warten, bis alle Kacheln in JEDEM sichtbaren Kartencontainer vollständig heruntergeladen, dekodiert und gerendert wurden
  await page.waitForFunction(
    () => {
      const visibleContainers = Array.from(
        document.querySelectorAll<HTMLElement>('.leaflet-container')
      ).filter((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      });
      if (visibleContainers.length === 0) return true; // Keine sichtbare Karte vorhanden

      for (const container of visibleContainers) {
        if (container.hasAttribute('data-tiles-loading')) return false;

        const tiles = Array.from(
          container.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile')
        );
        if (tiles.length === 0) return false;

        const allLoaded = tiles.every(
          (img) =>
            img.complete &&
            img.naturalWidth > 0 &&
            img.classList.contains('leaflet-tile-loaded') &&
            parseFloat(window.getComputedStyle(img).opacity || '0') >= 0.9
        );
        if (!allLoaded) return false;
      }

      return true;
    },
    undefined,
    { timeout: timeoutMs }
  );

  // 3. Settle-Puffer für Leaflets Layout-Updates & Compositing
  await page.waitForTimeout(500);
}
