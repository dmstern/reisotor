import { expect, type Locator, type Page } from '@playwright/test';

/** Repräsentative Viewports für die Layout-Overlap-Suite (siehe layout-overlap.spec.ts):
 *  - mobile: fixierte NavBar + Bottom-Sheet-Schubladen (ExcursionsView.vue).
 *  - narrowDesktop: > 800px (useIsDesktop.ts-Schwelle, Drawer.vue mountet), aber < 900px
 *    (ExcursionsView.vue's @container-Schwelle für das Desktop-Sticky-Spalten-Layout) — deckt den
 *    "Desktop-Modus mit stark eingeschränktem .app-main" ab (z. B. beide Schubladen gleichzeitig
 *    offen), der eigene .page-Regeln nutzt (siehe ExcursionsView.vue).
 *  - desktop: komfortable Breite, beide Schubladen offen ohne Platznot. */
export const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  narrowDesktop: { width: 850, height: 900 },
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
  expect(box.right, 'Element ragt rechts aus dem Viewport').toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.bottom, 'Element ragt unten aus dem Viewport').toBeLessThanOrEqual(viewport.height + 0.5);
}

/** Das Kind-Element muss vollständig innerhalb der Box des Eltern-/Container-Elements liegen (z. B.
 *  ein Button darf nicht aus seiner Card herausragen). Kleine Toleranz für Subpixel-Rundung. */
export async function expectWithinBox(child: Locator, parent: Locator): Promise<void> {
  const childBox = await boxOf(child);
  const parentBox = await boxOf(parent);
  const tolerance = 1;
  expect(childBox.left, 'Element ragt links aus dem Container').toBeGreaterThanOrEqual(parentBox.left - tolerance);
  expect(childBox.top, 'Element ragt oben aus dem Container').toBeGreaterThanOrEqual(parentBox.top - tolerance);
  expect(childBox.right, 'Element ragt rechts aus dem Container').toBeLessThanOrEqual(parentBox.right + tolerance);
  expect(childBox.bottom, 'Element ragt unten aus dem Container').toBeLessThanOrEqual(parentBox.bottom + tolerance);
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
function samplePoints(box: Box, viewport: { width: number; height: number }): { x: number; y: number }[] {
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
export async function expectNotCoveredBy(page: Page, target: Locator, blocker: Locator): Promise<void> {
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
        const coveredByBlocker = !!hit && !!blockerEl && (hit === blockerEl || blockerEl.contains(hit));
        return { visible, coveredByBlocker, hitTag: hit ? hit.tagName + (hit.className ? `.${String(hit.className).split(' ').join('.')}` : '') : null };
      },
      [targetHandle, blockerHandle, point.x, point.y] as const,
    );
    expect(
      result.visible,
      `Punkt (${point.x}, ${point.y}) auf dem Ziel-Element trifft stattdessen "${result.hitTag}"` +
        (result.coveredByBlocker ? ' (verdeckt durch das als blocker übergebene Element)' : ''),
    ).toBe(true);
  }
}

/** Rein geometrische Nicht-Überlappungs-Prüfung zweier Boxen, ohne Deckungs-Semantik — für Fälle, in
 *  denen zwei Elemente schlicht nebeneinander erwartet werden (z. B. zwei Buttons, die sich nicht
 *  überlappen sollen). Für "liegt A sichtbar über/unter B" stattdessen expectNotCoveredBy nutzen. */
export async function expectNoOverlap(a: Locator, b: Locator): Promise<void> {
  const boxA = await boxOf(a);
  const boxB = await boxOf(b);
  const overlaps = boxA.left < boxB.right && boxA.right > boxB.left && boxA.top < boxB.bottom && boxA.bottom > boxB.top;
  expect(overlaps, 'Zwei Elemente überlappen sich geometrisch, obwohl sie das nicht sollten').toBe(false);
}
