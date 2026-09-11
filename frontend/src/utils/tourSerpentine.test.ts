import { describe, expect, it } from 'vitest';
import type { Excursion, ExcursionLeg, Spot } from '../api/types';
import {
  buildTourSerpentineRows,
  buildLoopSegments,
  computeTourLoopPath,
  type TourSpotBox,
} from './tourSerpentine';

function makeSpot(id: number, title = `Spot ${id}`): Spot {
  return {
    id,
    trip_id: 1,
    title,
    image_url: null,
    category: 'Sightseeing',
    address: 'Street',
    maps_link: null,
    lat: 38.7,
    lng: -9.1,
    created_by: 1,
    paid_by_user_id: null,
    is_home: 0,
    start_date: null,
    end_date: null,
    checkin: null,
    checkout: null,
    contact: null,
    amount: null,
    budget_expense_id: null,
    done: 0,
    note: null,
    note_format: 'text',
  };
}

describe('buildTourSerpentineRows', () => {
  it('returns empty array when items are empty', () => {
    expect(buildTourSerpentineRows([], 2)).toEqual([]);
  });

  it('produces single vertical column with row breaks when cols === 1', () => {
    const items = [makeSpot(1), makeSpot(2), makeSpot(3)].map((spot) => ({ spot }));
    const rows = buildTourSerpentineRows(items, 1);

    expect(rows).toHaveLength(3);

    // Row 0
    expect(rows[0].isRtl).toBe(false);
    expect(rows[0].cells).toHaveLength(1);
    expect(rows[0].cells[0]).toEqual({
      type: 'spot',
      key: 'spot-1',
      spot: items[0].spot,
      globalIndex: 0,
    });
    expect(rows[0].rowBreak).toBeDefined();
    expect(rows[0].rowBreak?.fromSpot.id).toBe(1);
    expect(rows[0].rowBreak?.toSpot.id).toBe(2);
    expect(rows[0].rowBreak?.alignSide).toBe('left');

    // Row 1
    expect(rows[1].isRtl).toBe(false);
    expect(rows[1].cells).toHaveLength(1);
    expect(rows[1].rowBreak?.fromSpot.id).toBe(2);
    expect(rows[1].rowBreak?.toSpot.id).toBe(3);

    // Row 2 (last)
    expect(rows[2].cells).toHaveLength(1);
    expect(rows[2].rowBreak).toBeUndefined();
  });

  it('handles 2 columns with S-curve (LTR then RTL)', () => {
    const items = [1, 2, 3, 4, 5].map((id) => ({ spot: makeSpot(id) }));
    const rows = buildTourSerpentineRows(items, 2);

    expect(rows).toHaveLength(3);

    // Row 0: LTR, spots 1 & 2, with horizontal leg between them
    expect(rows[0].rowIndex).toBe(0);
    expect(rows[0].isRtl).toBe(false);
    expect(rows[0].cells).toHaveLength(3);
    expect(rows[0].cells[0].type).toBe('spot');
    expect(rows[0].cells[1].type).toBe('leg-horizontal');
    expect(rows[0].cells[2].type).toBe('spot');
    expect(rows[0].rowBreak?.fromSpot.id).toBe(2);
    expect(rows[0].rowBreak?.toSpot.id).toBe(3);
    expect(rows[0].rowBreak?.alignSide).toBe('right');

    // Row 1: RTL, spots 3 & 4, with horizontal leg between them
    expect(rows[1].rowIndex).toBe(1);
    expect(rows[1].isRtl).toBe(true);
    expect(rows[1].cells).toHaveLength(3);
    expect(rows[1].rowBreak?.fromSpot.id).toBe(4);
    expect(rows[1].rowBreak?.toSpot.id).toBe(5);
    expect(rows[1].rowBreak?.alignSide).toBe('left');

    // Row 2: LTR, spot 5 (incomplete row, no rowBreak)
    expect(rows[2].rowIndex).toBe(2);
    expect(rows[2].isRtl).toBe(false);
    expect(rows[2].cells).toHaveLength(1);
    expect(rows[2].rowBreak).toBeUndefined();
  });

  it('handles 3 columns correctly with partial second row', () => {
    const items = [1, 2, 3, 4, 5].map((id) => ({ spot: makeSpot(id) }));
    const rows = buildTourSerpentineRows(items, 3);

    expect(rows).toHaveLength(2);

    // Row 0: LTR, spots 1, 2, 3 -> 5 cells
    expect(rows[0].isRtl).toBe(false);
    expect(rows[0].cells).toHaveLength(5);
    expect(rows[0].rowBreak?.fromSpot.id).toBe(3);
    expect(rows[0].rowBreak?.toSpot.id).toBe(4);
    expect(rows[0].rowBreak?.alignSide).toBe('right');

    // Row 1: RTL, spots 4, 5 -> 3 cells
    expect(rows[1].isRtl).toBe(true);
    expect(rows[1].cells).toHaveLength(3);
    expect(rows[1].cells[1]).toMatchObject({
      type: 'leg-horizontal',
      isRtl: true,
    });
    expect(rows[1].rowBreak).toBeUndefined();
  });

  it('associates excursion legs with horizontal and row-break connectors', () => {
    const items = [1, 2, 3].map((id) => ({ spot: makeSpot(id) }));
    const excursion = {
      id: 99,
      trip_id: 1,
      title: 'Test Tour',
      date: null,
      role: null,
      spot_ids: [1, 2, 3],
      legs: [
        { id: 10, from_spot_id: 1, to_spot_id: 2, transport_type: 'Zug', position: 0 },
        { id: 11, from_spot_id: 2, to_spot_id: 3, transport_type: 'Bus', position: 1 },
      ],
      created_by: 1,
      budget_expense_id: null,
      note: null,
      note_format: 'text',
      amount: null,
      paid_by_user_id: null,
    } as unknown as Excursion;

    const getTourLeg = (exc: Excursion, fromId: number, toId: number): ExcursionLeg | undefined =>
      exc.legs?.find((l) => l.from_spot_id === fromId && l.to_spot_id === toId);

    const rows = buildTourSerpentineRows(items, 2, excursion, getTourLeg);

    // Row 0: Spot 1 -> Leg(10) -> Spot 2, RowBreak(Leg 11)
    const horizLegCell = rows[0].cells[1];
    expect(horizLegCell.type).toBe('leg-horizontal');
    if (horizLegCell.type === 'leg-horizontal') {
      expect(horizLegCell.leg?.transport_type).toBe('Zug');
    }

    expect(rows[0].rowBreak?.leg?.transport_type).toBe('Bus');
  });
});

describe('buildLoopSegments', () => {
  it('returns empty array when route has no returning segments', () => {
    expect(buildLoopSegments([1, 2, 3], [1, 2, 3])).toEqual([]);
  });

  it('detects round trip loop from last spot back to first', () => {
    expect(buildLoopSegments([1, 2, 3, 1], [1, 2, 3])).toEqual([[2, 0]]);
  });

  it('detects intermediate loop back to an earlier spot', () => {
    expect(buildLoopSegments([1, 2, 3, 2, 4], [1, 2, 3, 4])).toEqual([
      [2, 1],
      [1, 3],
    ]);
  });
});

describe('computeTourLoopPath', () => {
  function makeBox(x: number, y: number, width = 200, height = 150): TourSpotBox {
    return {
      x,
      y,
      top: y,
      bottom: y + height,
      right: x + width,
      width,
      height,
      cx: x + width / 2,
      cy: y + height / 2,
    };
  }

  it('takes the shortest interior path (exits left, curves up into bottom) when spot 3 returns to spot 1 in 2-column layout', () => {
    // Spot 1: row 0, col 0 (top-left)
    const spot1 = makeBox(20, 20); // x:20..220, y:20..170, cx:120, cy:95, bottom:170
    // Spot 2: row 0, col 1 (top-right)
    const spot2 = makeBox(260, 20); // x:260..460, y:20..170, cx:360, cy:95, bottom:170
    // Spot 3: row 1, col 1 (bottom-right)
    const spot3 = makeBox(260, 240); // x:260..460, y:240..390, cx:360, cy:315, bottom:390
    // Col 0, row 1 is EMPTY

    const result = computeTourLoopPath(spot3, spot1, [spot1, spot2, spot3], 500);

    // Starts at left edge of spot 3 (x=260, cy=315)
    expect(result.dots[0]).toEqual({ x: 260, y: 315 });
    // Ends at bottom edge of spot 1 (cx=120, bottom=170)
    expect(result.dots[1]).toEqual({ x: 120, y: 170 });
    // Path moves left and up, entering spot 1 from below
    expect(result.d).toContain('M 260 315');
    expect(result.d).toContain('120 170');
  });

  it('connects directly upward when last spot is directly below first spot with no card in between', () => {
    // Spot 1: row 0, col 0
    const spot1 = makeBox(20, 20);
    // Spot 4: row 1, col 0 (directly below spot 1)
    const spot4 = makeBox(20, 240);

    const result = computeTourLoopPath(spot4, spot1, [spot1, spot4], 500);

    // Starts at top edge of spot 4 (cx=120 - 20 = 100, top=240)
    expect(result.dots[0]).toEqual({ x: 100, y: 240 });
    // Ends at bottom edge of spot 1 (cx=120 + 20 = 140, bottom=170)
    expect(result.dots[1]).toEqual({ x: 140, y: 170 });
  });

  it('uses under-row U-curve when spots are in the same row with empty space below', () => {
    // Spot 1: col 0, row 0
    const spot1 = makeBox(20, 20);
    // Spot 2: col 1, row 0
    const spot2 = makeBox(260, 20);
    // Spot 3: col 2, row 0
    const spot3 = makeBox(500, 20);

    const result = computeTourLoopPath(spot3, spot1, [spot1, spot2, spot3], 800);

    expect(result.dots[0]).toEqual({ x: 600, y: 170 }); // spot3 cx, bottom
    expect(result.dots[1]).toEqual({ x: 120, y: 170 }); // spot1 cx, bottom
  });

  it('falls back to outer side arc when cards are in single column with obstacle in between', () => {
    // Single column: spot 1, spot 2, spot 3 vertically stacked
    const spot1 = makeBox(20, 20);
    const spot2 = makeBox(20, 200); // obstacle in between
    const spot3 = makeBox(20, 380);

    const result = computeTourLoopPath(spot3, spot1, [spot1, spot2, spot3], 240);

    // Fallback side arc along the side
    expect(result.dots).toHaveLength(2);
    expect(result.d).toContain('C');
  });
});
