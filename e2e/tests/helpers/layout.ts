import { expect, type Locator, type Page } from '@playwright/test';

/** Repräsentative Viewports für die Layout-Overlap-Suite (siehe layout-overlap.spec.ts):
 *  - mobile: fixierte NavBar + Bottom-Sheet-Schubladen (ExcursionsView.vue).
 *  - narrowDesktop: > 1024px (useIsDesktop.ts-Schwelle, Drawer.vue mountet) — deckt den
 *    Desktop-Modus mit geöffneter Kalender-Schublade ab.
 *  - desktop: komfortable Breite, beide Schubladen offen ohne Platznot. */
export const VIEWPORTS = {
  narrowMobile: { width: 320, height: 568 },
  mobile: { width: 390, height: 844 },
  narrowDesktop: { width: 1080, height: 900 },
  desktop: { width: 1280, height: 800 },
} as const;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Wrapped boundingBox() mit aussagekräftigem Fehler statt eines stillen `null`, falls das Element
 *  nicht im DOM oder nicht sichtbar ist (z. B. falscher Selektor, Element noch hinter einer
 *  Transition). */
export async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`boxOf: Element nicht sichtbar/nicht im DOM (Selector: ${locator})`);
  }
  return {
    ...box,
    top: box.y,
    left: box.x,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

/** Kein Element darf über den sichtbaren Viewport hinausragen (Button/Karte "fließt raus"). */
export async function expectWithinViewport(page: Page, locator: Locator): Promise<void> {
  const box = await boxOf(locator);
  const viewport = page.viewportSize();
  expect(viewport, 'page.viewportSize() ist null').not.toBeNull();
  if (!viewport) return;
  expect(box.left, 'Element ragt links aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
  expect(box.top, 'Element ragt oben aus dem Viewport').toBeGreaterThanOrEqual(-0.5);
  expect(box.right, 'Element ragt rechts aus dem Viewport').toBeLessThanOrEqual(
    viewport.width + 0.5
  );
  expect(box.bottom, 'Element ragt unten aus dem Viewport').toBeLessThanOrEqual(
    viewport.height + 0.5
  );
}

/** Das Kind-Element muss vollständig innerhalb der Box des Eltern-/Container-Elements liegen (z. B.
 *  ein Button darf nicht aus seiner Card herausragen). Kleine Toleranz für Subpixel-Rundung. */
export async function expectWithinBox(child: Locator, parent: Locator): Promise<void> {
  const childBox = await boxOf(child);
  const parentBox = await boxOf(parent);
  const tolerance = 1;
  expect(childBox.left, 'Element ragt links aus dem Container').toBeGreaterThanOrEqual(
    parentBox.left - tolerance
  );
  expect(childBox.top, 'Element ragt oben aus dem Container').toBeGreaterThanOrEqual(
    parentBox.top - tolerance
  );
  expect(childBox.right, 'Element ragt rechts aus dem Container').toBeLessThanOrEqual(
    parentBox.right + tolerance
  );
  expect(childBox.bottom, 'Element ragt unten aus dem Container').toBeLessThanOrEqual(
    parentBox.bottom + tolerance
  );
}

// Mittelpunkte der vier Kanten statt der Ecken: exakte Ecken-Testpunkte fallen bei abgerundeten
// Ecken (border-radius, in dieser App praktisch überall verwendet) leicht in den weggeschnittenen
// Ecken-Bereich der tatsächlichen Form – dort trifft elementFromPoint() dann fälschlich das
// dahinterliegende Element (z. B. ein Backdrop), obwohl das Zielelement selbst gar nicht verdeckt
// ist. Kanten-Mittelpunkte sind von border-radius nie betroffen, unabhängig vom Radius.
// Nur den sichtbaren Anteil der Box im Viewport sampeln: elementFromPoint() liefert sonst "null"
// für Koordinaten außerhalb des Viewports (z. B. schmale Mobile-Viewports + leicht überstehende
// Status-Pills), was zu falschen Fehlschlägen führt — siehe layout-overlap.spec.ts, Kommentar bei
// statusChip.scrollIntoViewIfNeeded().
function samplePoints(
  box: Box,
  viewport: { width: number; height: number }
): { x: number; y: number }[] {
  const left = Math.max(box.left, 0);
  const top = Math.max(box.top, 0);
  const right = Math.min(box.right, viewport.width);
  const bottom = Math.min(box.bottom, viewport.height);
  const visible: Box = {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    left,
    top,
    right,
    bottom,
  };
  if (visible.width < 1 || visible.height < 1) {
    throw new Error('target-Element hat keinen sichtbaren Anteil im Viewport');
  }
  const inset = Math.min(2, visible.width / 4, visible.height / 4);
  const midX = visible.left + visible.width / 2;
  const midY = visible.top + visible.height / 2;
  return [
    { x: midX, y: midY },
    { x: midX, y: visible.top + inset },
    { x: midX, y: visible.bottom - inset },
    { x: visible.left + inset, y: midY },
    { x: visible.right - inset, y: midY },
  ];
}

/** Prüft per `document.elementFromPoint()` (statt reiner Rechteck-Überlappung), ob `target`
 *  tatsächlich sichtbar obenauf gerendert wird, statt von `blocker` (z. B. Schublade, NavBar,
 *  Dialog) optisch verdeckt zu sein — reine Boxen-Überlappung allein kann das nicht unterscheiden,
 *  da sie nichts über z-index/Render-Reihenfolge aussagt. Testet Mittelpunkt + vier (leicht nach
 *  innen versetzte) Ecken von `target`. */
export async function expectNotCoveredBy(
  page: Page,
  target: Locator,
  blocker: Locator
): Promise<void> {
  const targetHandle = await target.elementHandle();
  const blockerHandle = await blocker.elementHandle();
  expect(targetHandle, 'target-Element nicht auffindbar').not.toBeNull();
  if (!targetHandle) return;
  const box = await boxOf(target);
  const viewport = page.viewportSize();
  expect(viewport, 'page.viewportSize() ist null').not.toBeNull();
  if (!viewport) return;

  for (const point of samplePoints(box, viewport)) {
    const result = await page.evaluate(
      ([el, blockerEl, x, y]) => {
        const hit = document.elementFromPoint(x, y);
        const visible = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        const coveredByBlocker =
          !!hit && !!blockerEl && (hit === blockerEl || blockerEl.contains(hit));
        return {
          visible,
          coveredByBlocker,
          hitTag: hit
            ? hit.tagName + (hit.className ? `.${String(hit.className).split(' ').join('.')}` : '')
            : null,
        };
      },
      [targetHandle, blockerHandle, point.x, point.y] as const
    );
    expect(
      result.visible,
      `Punkt (${point.x}, ${point.y}) auf dem Ziel-Element trifft stattdessen "${result.hitTag}"` +
        (result.coveredByBlocker ? ' (verdeckt durch das als blocker übergebene Element)' : '')
    ).toBe(true);
  }
}

/** Rein geometrische Nicht-Überlappungs-Prüfung zweier Boxen, ohne Deckungs-Semantik — für Fälle, in
 *  denen zwei Elemente schlicht nebeneinander erwartet werden (z. B. zwei Buttons, die sich nicht
 *  überlappen sollen). Für "liegt A sichtbar über/unter B" stattdessen expectNotCoveredBy nutzen. */
export async function expectNoOverlap(a: Locator, b: Locator): Promise<void> {
  const boxA = await boxOf(a);
  const boxB = await boxOf(b);
  const overlaps =
    boxA.left < boxB.right &&
    boxA.right > boxB.left &&
    boxA.top < boxB.bottom &&
    boxA.bottom > boxB.top;
  expect(overlaps, 'Zwei Elemente überlappen sich geometrisch, obwohl sie das nicht sollten').toBe(
    false
  );
}

/** Prüft, ob das Layout die Breite des Viewports überschreitet (unerwünschter horizontaler Scrollbalken).
 *  Besonders kritisch auf mobilen Viewports (320px/390px), um Layout-Breaks und ungewolltes horizontales
 *  Ausbrechen sofort abzufangen. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);
    const clientWidth = doc.clientWidth;
    return {
      scrollWidth,
      clientWidth,
      hasOverflow: scrollWidth > clientWidth + 1, // 1px Toleranz für Subpixel-Rundung
    };
  });
  expect(
    overflow.hasOverflow,
    `Horizontaler Overflow erkannt: scrollWidth (${overflow.scrollWidth}px) > clientWidth (${overflow.clientWidth}px)`
  ).toBe(false);
}

/** Prüft, ob ein interaktives Element (Button, Chip, Icon-Button) die empfohlene Mindest-Touch-Target-
 *  Größe (Standard: 44x44px laut DESIGN.md und WCAG) einhält. */
export async function expectMinTouchTarget(locator: Locator, minSize = 44): Promise<void> {
  const box = await boxOf(locator);
  const tolerance = 0.5;
  expect(
    box.width,
    `Touch-Target-Breite (${box.width}px) ist kleiner als Mindestmaß ${minSize}px`
  ).toBeGreaterThanOrEqual(minSize - tolerance);
  expect(
    box.height,
    `Touch-Target-Höhe (${box.height}px) ist kleiner als Mindestmaß ${minSize}px`
  ).toBeGreaterThanOrEqual(minSize - tolerance);
}

/** Steuert den Zustand der Kalenderschublade (.drawer auf Desktop >=1024px) gezielt auf offen oder
 *  geschlossen, um Container-Queries (@container app-main) und Layout-Kollisionen bei reduzierter
 *  Inhaltsbreite (z. B. 1080px Viewport mit 360px Schublade = 720px Restbreite) zu testen. */
export async function setCalendarDrawerOpen(page: Page, open: boolean): Promise<void> {
  const drawer = page.locator('.drawer.left');
  if ((await drawer.count()) === 0) return; // Auf Mobile (<1024px) existiert keine Schublade

  const isOpen = await drawer.evaluate((el) => el.classList.contains('open'));
  if (isOpen !== open) {
    if (open) {
      // Wenn geschlossen: Klick auf den Tab zum Öffnen
      await page.locator('.drawer.left .drawer-tab').click();
    } else {
      // Wenn geöffnet: Klick auf den Schließen-Button im Header des Panels
      await page.locator('.drawer.left .close-drawer-btn').click();
    }
    await page.waitForTimeout(350); // Pause für die Einrast-Transition der Schublade
  }
}

/** Ermittelt die tatsächliche gerenderte Inhaltsbreite des .app-main Containers (Viewport abzüglich
 *  geöffneter Schubladen). Wichtig zur Validierung von @container app-main Abfragen. */
export async function getAppMainContentWidth(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const el = document.querySelector('.app-main');
    return el ? el.getBoundingClientRect().width : window.innerWidth;
  });
}

/** Verstellt die Breite der Kalenderschublade auf Desktop stufenlos durch Ziehen des Anfassers.
 *  Erlaubt das Stresstesten extremer Breiten (z. B. Minimum 280px oder Maximum 500px+). */
export async function setCalendarDrawerWidth(page: Page, targetWidth: number): Promise<void> {
  await setCalendarDrawerOpen(page, true);
  const handle = page.locator('.drawer.left .resize-handle');
  if ((await handle.count()) === 0 || !(await handle.isVisible())) return;

  const box = await boxOf(handle);
  const deltaX = targetWidth - box.left;
  await page.mouse.move(box.left + box.width / 2, box.top + 100);
  await page.mouse.down();
  await page.mouse.move(box.left + deltaX, box.top + 100, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Verstellt die Breite der Spots-Spalte (.spots-col in ExcursionsView) auf Desktop stufenlos durch
 *  Ziehen des Spalten-Anfassers (.col-resize-handle). */
export async function setSpotsColumnWidth(page: Page, targetWidth: number): Promise<void> {
  const handle = page.locator('.col-resize-handle');
  if ((await handle.count()) === 0 || !(await handle.isVisible())) return;

  const box = await boxOf(handle);
  const deltaX = targetWidth - box.left;
  await page.mouse.move(box.left + box.width / 2, box.top + 100);
  await page.mouse.down();
  await page.mouse.move(box.left + deltaX, box.top + 100, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
