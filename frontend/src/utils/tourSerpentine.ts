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
