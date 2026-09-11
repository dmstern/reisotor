import type { Excursion, ExcursionLeg, Spot } from '../api/types';

export interface TourSpotItem {
  spot: Spot;
}

export type TourCell =
  | {
      type: 'spot';
      key: string;
      spot: Spot;
      globalIndex: number;
    }
  | {
      type: 'leg-horizontal';
      key: string;
      fromSpot: Spot;
      toSpot: Spot;
      leg?: ExcursionLeg;
      isRtl: boolean;
    };

export interface TourRowBreak {
  key: string;
  fromSpot: Spot;
  toSpot: Spot;
  leg?: ExcursionLeg;
  alignSide: 'left' | 'right';
  rowIndex: number;
}

export interface TourSerpentineRow {
  rowIndex: number;
  isRtl: boolean;
  cells: TourCell[];
  rowBreak?: TourRowBreak;
}

/**
 * Teilt die Spots einer Tour basierend auf der Spaltenanzahl in Zeilen für ein Schlangen-Layout (Serpentine / S-Kurve) ein:
 * - Gerade Zeilen (0, 2, ...): LTR (Links nach Rechts)
 * - Ungerade Zeilen (1, 3, ...): RTL (Rechts nach Links)
 * - Innerhalb einer Zeile: Horizontale Verbinder ("hochkant") zwischen nebeneinanderliegenden Spots
 * - Zwischen zwei Zeilen: Zeilenumbruch-Verbinder ("quer" / U-Turn), ausgerichtet am rechten Rand (LTR -> RTL)
 *   bzw. linken Rand (RTL -> LTR)
 * - Bei 1 Spalte: Degeneriert 100% nahtlos zu einer rein vertikalen Liste
 */
export function buildTourSerpentineRows(
  items: TourSpotItem[],
  cols: number,
  excursion?: Excursion | null,
  getTourLeg?: (
    excursion: Excursion,
    fromSpotId: number,
    toSpotId: number
  ) => ExcursionLeg | undefined
): TourSerpentineRow[] {
  if (!items.length) return [];
  const safeCols = Math.max(1, cols);

  const rows: TourSerpentineRow[] = [];
  const total = items.length;

  let currentIndex = 0;
  let rowIndex = 0;

  while (currentIndex < total) {
    const isRtl = safeCols > 1 && rowIndex % 2 === 1;
    const rowSpots: Array<{ spot: Spot; globalIndex: number }> = [];

    const end = Math.min(currentIndex + safeCols, total);
    for (let i = currentIndex; i < end; i++) {
      rowSpots.push({ spot: items[i].spot, globalIndex: i });
    }

    const cells: TourCell[] = [];
    for (let i = 0; i < rowSpots.length; i++) {
      const current = rowSpots[i];
      cells.push({
        type: 'spot',
        key: `spot-${current.spot.id}`,
        spot: current.spot,
        globalIndex: current.globalIndex,
      });

      // Wenn nicht der letzte Spot in dieser Zeile: horizontaler Verbinder zum nächsten Spot
      if (i < rowSpots.length - 1) {
        const next = rowSpots[i + 1];
        const leg =
          excursion && getTourLeg
            ? getTourLeg(excursion, current.spot.id, next.spot.id)
            : undefined;
        cells.push({
          type: 'leg-horizontal',
          key: `leg-horiz-${current.spot.id}-${next.spot.id}`,
          fromSpot: current.spot,
          toSpot: next.spot,
          leg,
          isRtl,
        });
      }
    }

    let rowBreak: TourRowBreak | undefined;
    // Wenn es noch weitere Spots in einer folgenden Zeile gibt: Zeilenumbruch-Verbinder
    if (end < total) {
      const lastSpot = rowSpots[rowSpots.length - 1].spot;
      const firstNextSpot = items[end].spot;
      const leg =
        excursion && getTourLeg ? getTourLeg(excursion, lastSpot.id, firstNextSpot.id) : undefined;

      // Bei LTR endete die Zeile rechts -> Umbruch rechts. Bei RTL endete sie links -> Umbruch links.
      const alignSide: 'left' | 'right' = isRtl ? 'left' : 'right';

      rowBreak = {
        key: `row-break-${lastSpot.id}-${firstNextSpot.id}`,
        fromSpot: lastSpot,
        toSpot: firstNextSpot,
        leg,
        alignSide: safeCols === 1 ? 'left' : alignSide,
        rowIndex,
      };
    }

    rows.push({
      rowIndex,
      isRtl,
      cells,
      rowBreak,
    });

    currentIndex = end;
    rowIndex++;
  }

  return rows;
}

export interface TourSpotBox {
  x: number;
  y: number;
  top: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

/**
 * Ermittelt zusätzliche Kanten für Teilstrecken/Rückwege, wenn ein Spot mehrfach in der Tour vorkommt
 * (z. B. Start = Ziel: [1, 2, 3, 1] -> Kante 3 -> 1).
 */
export function buildLoopSegments(spotIds: number[], domSpotIds: number[]): [number, number][] {
  const domIndex = new Map<number, number>();
  domSpotIds.forEach((id, i) => {
    if (!domIndex.has(id)) domIndex.set(id, i);
  });
  const routeIndices = spotIds.map((id) => domIndex.get(id) ?? -1).filter((i) => i >= 0);
  const segments: [number, number][] = [];
  for (let i = 0; i < routeIndices.length - 1; i++) {
    const from = routeIndices[i];
    const to = routeIndices[i + 1];
    if (to < from || to !== from + 1) {
      segments.push([from, to]);
    }
  }
  return segments;
}

/**
 * Berechnet den SVG-Pfad und die Ankerpunkte für eine Zirkel-/Rückweglinie zwischen Spot a und b.
 * Wählt dabei immer den kürzesten, unversperrten Weg zur Ziel-Karte (bspw. links aus der letzten Card
 * heraus und geschwungen zur ersten Card hoch), statt starr hinter Zwischenkarten zu verschwinden.
 */
export function computeTourLoopPath(
  a: TourSpotBox,
  b: TourSpotBox,
  allBoxes: TourSpotBox[],
  wrapWidth: number
): { d: string; dots: { x: number; y: number }[] } {
  const dots: { x: number; y: number }[] = [];
  let d = '';

  const isSameCol = Math.abs(a.cx - b.cx) < 40;
  const isSameRow = Math.abs(a.cy - b.cy) < 40;

  // Fall 1: Gleiche Spalte und a liegt unter b (vertikal direkt nach oben)
  if (isSameCol && a.top > b.bottom) {
    const hasObstacle = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        Math.abs(box.cx - a.cx) < 40 &&
        box.bottom > b.bottom + 10 &&
        box.top < a.top - 10
    );

    if (!hasObstacle) {
      const hOffset = 20;
      const startX = a.cx - hOffset;
      const startY = a.top;
      const endX = b.cx + hOffset;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      dots.push({ x: endX, y: endY });
      const dy = endY - startY;
      d = ` M ${startX} ${startY} C ${startX} ${startY + dy * 0.45}, ${endX} ${endY - dy * 0.45}, ${endX} ${endY}`;
      return { d, dots };
    }
  }

  // Fall 2: a liegt rechts unterhalb von b (a.cx > b.cx und a.cy > b.cy)
  // Kürzester Weg: Links aus a heraus, durch den leeren Raum geschwungen und von unten an b
  if (a.cx > b.cx + 20 && a.cy > b.cy + 20) {
    const hasObstacleInBCol = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.cx < a.x &&
        box.bottom > b.bottom + 10 &&
        box.top < a.bottom + 10
    );

    if (!hasObstacleInBCol) {
      const startX = a.x;
      const startY = a.cy;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      dots.push({ x: endX, y: endY });
      const dx = startX - endX;
      const dy = startY - endY;
      const cp1X = startX - dx * 0.45;
      const cp1Y = startY;
      const cp2X = endX;
      const cp2Y = endY + dy * 0.45;
      d = ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      return { d, dots };
    }
  }

  // Fall 3: a liegt links unterhalb von b (a.cx < b.cx und a.cy > b.cy)
  if (a.cx < b.cx - 20 && a.cy > b.cy + 20) {
    const hasObstacleInBCol = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.cx > a.right &&
        box.bottom > b.bottom + 10 &&
        box.top < a.bottom + 10
    );

    if (!hasObstacleInBCol) {
      const startX = a.right;
      const startY = a.cy;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      dots.push({ x: endX, y: endY });
      const dx = endX - startX;
      const dy = startY - endY;
      const cp1X = startX + dx * 0.45;
      const cp1Y = startY;
      const cp2X = endX;
      const cp2Y = endY + dy * 0.45;
      d = ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      return { d, dots };
    }
  }

  // Fall 4: Gleiche Zeile (z. B. 3 Spalten, alle Kacheln in Zeile 0)
  if (isSameRow) {
    const hasObstacleBelow = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.top >= Math.min(a.bottom, b.bottom) - 10 &&
        box.top <= Math.max(a.bottom, b.bottom) + 80 &&
        box.right > Math.min(a.x, b.x) &&
        box.x < Math.max(a.right, b.right)
    );

    if (!hasObstacleBelow) {
      const startX = a.cx;
      const startY = a.bottom;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      dots.push({ x: endX, y: endY });
      const dropY =
        Math.max(a.bottom, b.bottom) + Math.min(60, Math.max(30, Math.abs(a.cx - b.cx) * 0.15));
      d = ` M ${startX} ${startY} C ${startX} ${dropY}, ${endX} ${dropY}, ${endX} ${endY}`;
      return { d, dots };
    }
  }

  // Fall 5: Außenbogen (Fallback, wenn Innenraum blockiert oder einspaltig)
  const isCloserToLeft = Math.max(a.cx, b.cx) < wrapWidth * 0.4;
  if (isCloserToLeft) {
    const startX = a.x;
    const startY = a.cy;
    const endX = b.x;
    const endY = b.cy;
    const arcExtent = Math.min(48, Math.max(24, Math.abs(endY - startY) * 0.25));
    const ctrlX = Math.max(0, Math.min(a.x, b.x) - arcExtent);
    dots.push({ x: startX, y: startY });
    dots.push({ x: endX, y: endY });
    d = ` M ${startX} ${startY} C ${ctrlX} ${startY}, ${ctrlX} ${endY}, ${endX} ${endY}`;
    return { d, dots };
  }

  const rightEdge = Math.max(wrapWidth, 100);
  const startX = a.right;
  const startY = a.cy;
  const endX = b.right;
  const endY = b.cy;
  const arcExtent = Math.min(48, Math.max(24, Math.abs(endY - startY) * 0.25));
  const ctrlX = rightEdge + arcExtent;
  dots.push({ x: startX, y: startY });
  dots.push({ x: endX, y: endY });
  d = ` M ${startX} ${startY} C ${ctrlX} ${startY}, ${ctrlX} ${endY}, ${endX} ${endY}`;
  return { d, dots };
}
