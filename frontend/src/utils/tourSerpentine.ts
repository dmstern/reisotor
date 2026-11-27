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
  if (!items.length) {
    return [];
  }

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
    if (!domIndex.has(id)) {
      domIndex.set(id, i);
    }
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

export interface TourLoopPathResult {
  d: string;
  dots: { x: number; y: number }[];
}

/**
 * Berechnet den SVG-Pfad, Ankerpunkte und Pfeilspitze für eine Zirkel-/Rückweglinie zwischen Spot a und b.
 * Wählt dabei immer den kürzesten, unversperrten Weg zur Ziel-Karte (bspw. unterhalb der Hinweg-Kacheln
 * entlang direkt zum Ausgangs-Spot hoch), statt starr hinter Zwischenkarten zu verschwinden.
 */
const SAME_AXIS_TOLERANCE_PX = 40;
const BEZIER_TENSION_VERTICAL = 0.45;
const DIAGONAL_THRESHOLD_PX = 20;
const BEZIER_TENSION_HORIZONTAL = 0.55;
const MIN_LOOP_DROP_Y_OFFSET_PX = 40;
const SAME_ROW_OBSTACLE_BELOW_PX = 80;
const SAME_ROW_DROP_MIN_PX = 30;
const SAME_ROW_DROP_RATIO = 0.15;
const OUTER_LOOP_MAX_OFFSET_PX = 80;
const OUTER_LOOP_MIN_OFFSET_PX = 56;
const OUTER_LOOP_HEIGHT_RATIO = 0.15;
const OUTER_LOOP_MIN_CTRL_X_PX = 4;
const OUTER_LOOP_CORNER_RADIUS_PX = 16;
const LEFT_LOOP_CENTER_BUFFER_PX = 20;
const OUTER_LOOP_RIGHT_EDGE_GAP_PX = 20;

export function computeTourLoopPath(
  a: TourSpotBox,
  b: TourSpotBox,
  allBoxes: TourSpotBox[],
  wrapWidth: number
): TourLoopPathResult {
  const dots: { x: number; y: number }[] = [];

  const isSameCol = Math.abs(a.cx - b.cx) < SAME_AXIS_TOLERANCE_PX;
  const isSameRow = Math.abs(a.cy - b.cy) < SAME_AXIS_TOLERANCE_PX;

  // Fall 1: Gleiche Spalte und a liegt unter b (vertikal direkt nach oben)
  if (isSameCol && a.top > b.bottom) {
    const hasObstacle = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        Math.abs(box.cx - a.cx) < SAME_AXIS_TOLERANCE_PX &&
        box.bottom > b.bottom + 10 &&
        box.top < a.top - 10
    );

    if (!hasObstacle) {
      const hOffset = 32;
      const startX = a.cx - hOffset;
      const startY = a.top;
      const endX = b.cx + hOffset;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      const dy = endY - startY;
      const cp1X = startX;
      const cp1Y = startY + dy * BEZIER_TENSION_VERTICAL;
      const cp2X = endX;
      const cp2Y = endY - dy * BEZIER_TENSION_VERTICAL;
      const pathData = ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      const _angle = Math.atan2(endY - cp2Y, endX - cp2X) * (180 / Math.PI);
      dots.push({ x: endX, y: endY });
      return { d: pathData, dots };
    }
  }

  // Fall 2: a liegt rechts unterhalb von b (a.cx > b.cx + 20 und a.cy > b.cy + 20)
  // Kürzester Weg: Links aus a heraus, unterhalb der Hinweg-Karten entlang und von unten an b
  if (a.cx > b.cx + DIAGONAL_THRESHOLD_PX && a.cy > b.cy + DIAGONAL_THRESHOLD_PX) {
    // Liegt ein Hindernis direkt unterhalb von b (in Spalte b) vor a.cy?
    const hasObstacleBelowB = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        Math.abs(box.cx - b.cx) < b.width * 0.5 &&
        box.top < a.cy &&
        box.bottom > b.bottom
    );

    // Liegt ein Hindernis in Zeile a zwischen b.cx und a.x?
    const hasObstacleInRowA = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.cx > b.cx + b.width * 0.5 &&
        box.cx < a.x - 10 &&
        box.bottom > a.top + 10 &&
        box.top < a.bottom - 10
    );

    if (!hasObstacleBelowB && !hasObstacleInRowA) {
      const startX = a.x;
      const startY = a.cy;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });

      const dx = startX - endX;
      const dy = startY - endY;
      // Der Pfad läuft horizontal unterhalb der Hinweg-Karten nach links bis zur Spalte von b
      // und biegt erst dort geschmeidig nach oben in b.bottom ein.
      const cp1X = Math.max(endX + 60, startX - dx * BEZIER_TENSION_HORIZONTAL);
      const cp1Y = startY;
      const cp2X = endX;
      const cp2Y = Math.min(
        startY,
        endY + Math.max(MIN_LOOP_DROP_Y_OFFSET_PX, dy * BEZIER_TENSION_VERTICAL)
      );
      const pathData = ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      const _angle = Math.atan2(endY - cp2Y, endX - cp2X) * (180 / Math.PI);
      dots.push({ x: endX, y: endY });
      return { d: pathData, dots };
    }
  }

  // Fall 3: a liegt links unterhalb von b (a.cx < b.cx - 20 und a.cy > b.cy + 20)
  // Rechts aus a heraus, unterhalb der Kacheln entlang und von unten an b
  if (a.cx < b.cx - DIAGONAL_THRESHOLD_PX && a.cy > b.cy + DIAGONAL_THRESHOLD_PX) {
    const hasObstacleBelowB = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        Math.abs(box.cx - b.cx) < b.width * 0.5 &&
        box.top < a.cy &&
        box.bottom > b.bottom
    );

    const hasObstacleInRowA = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.cx < b.cx - b.width * 0.5 &&
        box.cx > a.right + 10 &&
        box.bottom > a.top + 10 &&
        box.top < a.bottom - 10
    );

    if (!hasObstacleBelowB && !hasObstacleInRowA) {
      const startX = a.right;
      const startY = a.cy;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });

      const dx = endX - startX;
      const dy = startY - endY;
      const cp1X = Math.min(endX - 60, startX + dx * BEZIER_TENSION_HORIZONTAL);
      const cp1Y = startY;
      const cp2X = endX;
      const cp2Y = Math.min(
        startY,
        endY + Math.max(MIN_LOOP_DROP_Y_OFFSET_PX, dy * BEZIER_TENSION_VERTICAL)
      );
      const pathData = ` M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
      const _angle = Math.atan2(endY - cp2Y, endX - cp2X) * (180 / Math.PI);
      dots.push({ x: endX, y: endY });
      return { d: pathData, dots };
    }
  }

  // Fall 4: Gleiche Zeile (z. B. alle Kacheln in Zeile 0, Tour kehrt zum Start zurück)
  if (isSameRow) {
    const hasObstacleBelow = allBoxes.some(
      (box) =>
        box !== a &&
        box !== b &&
        box.top >= Math.min(a.bottom, b.bottom) - 10 &&
        box.top <= Math.max(a.bottom, b.bottom) + SAME_ROW_OBSTACLE_BELOW_PX &&
        box.right > Math.min(a.x, b.x) &&
        box.x < Math.max(a.right, b.right)
    );

    if (!hasObstacleBelow) {
      const startX = a.cx;
      const startY = a.bottom;
      const endX = b.cx;
      const endY = b.bottom;
      dots.push({ x: startX, y: startY });
      const dropY =
        Math.max(a.bottom, b.bottom) +
        Math.min(60, Math.max(SAME_ROW_DROP_MIN_PX, Math.abs(a.cx - b.cx) * SAME_ROW_DROP_RATIO));
      const pathData = ` M ${startX} ${startY} C ${startX} ${dropY}, ${endX} ${dropY}, ${endX} ${endY}`;
      const _angle = Math.atan2(endY - dropY, endX - endX) * (180 / Math.PI);
      dots.push({ x: endX, y: endY });
      return { d: pathData, dots };
    }
  }

  // Fall 5: Außenbogen (Fallback, wenn Innenraum blockiert oder einspaltig)
  // Wenn b auf der linken Bildschirmhälfte oder mittig liegt (z.B. Start-Spot bei col 0 oder einspaltiges Layout),
  // stets über die linke Seite führen! Einspaltig = exakt mittig (0.5), daher kleiner-gleich mit leichtem Puffer.
  const isCloserToLeft = b.cx <= wrapWidth * 0.5 + LEFT_LOOP_CENTER_BUFFER_PX;

  if (isCloserToLeft) {
    const startX = a.x;
    const startY = a.cy;
    const endX = b.x;
    const endY = b.cy;

    dots.push({ x: startX, y: startY });

    // Abgerundete Knicke statt langgezogener Bezier-Kurve
    const hOffset = Math.min(
      OUTER_LOOP_MAX_OFFSET_PX,
      Math.max(OUTER_LOOP_MIN_OFFSET_PX, Math.abs(endY - startY) * OUTER_LOOP_HEIGHT_RATIO)
    );
    const ctrlX = Math.max(OUTER_LOOP_MIN_CTRL_X_PX, Math.min(a.x, b.x) - hOffset);
    const dirY = Math.sign(endY - startY) || 1;

    const rStart = Math.min(
      OUTER_LOOP_CORNER_RADIUS_PX,
      Math.abs(startX - ctrlX),
      Math.abs(endY - startY) / 2
    );
    const rEnd = Math.min(
      OUTER_LOOP_CORNER_RADIUS_PX,
      Math.abs(endX - ctrlX),
      Math.abs(endY - startY) / 2
    );

    const pathData = ` M ${startX} ${startY} L ${ctrlX + rStart} ${startY} Q ${ctrlX} ${startY}, ${ctrlX} ${startY + dirY * rStart} L ${ctrlX} ${endY - dirY * rEnd} Q ${ctrlX} ${endY}, ${ctrlX + rEnd} ${endY} L ${endX} ${endY}`;

    dots.push({ x: endX, y: endY });
    return { d: pathData, dots };
  }

  const rightEdge = Math.max(wrapWidth, Math.max(a.right, b.right) + OUTER_LOOP_RIGHT_EDGE_GAP_PX);
  const startX = a.right;
  const startY = a.cy;
  const endX = b.right;
  const endY = b.cy;

  dots.push({ x: startX, y: startY });

  const hOffset = Math.min(
    OUTER_LOOP_MAX_OFFSET_PX,
    Math.max(OUTER_LOOP_MIN_OFFSET_PX, Math.abs(endY - startY) * OUTER_LOOP_HEIGHT_RATIO)
  );
  const ctrlX = rightEdge + hOffset;
  const dirY = Math.sign(endY - startY) || 1;

  const rStart = Math.min(
    OUTER_LOOP_CORNER_RADIUS_PX,
    Math.abs(startX - ctrlX),
    Math.abs(endY - startY) / 2
  );
  const rEnd = Math.min(
    OUTER_LOOP_CORNER_RADIUS_PX,
    Math.abs(endX - ctrlX),
    Math.abs(endY - startY) / 2
  );

  const pathData = ` M ${startX} ${startY} L ${ctrlX - rStart} ${startY} Q ${ctrlX} ${startY}, ${ctrlX} ${startY + dirY * rStart} L ${ctrlX} ${endY - dirY * rEnd} Q ${ctrlX} ${endY}, ${ctrlX - rEnd} ${endY} L ${endX} ${endY}`;

  dots.push({ x: endX, y: endY });
  return { d: pathData, dots };
}
