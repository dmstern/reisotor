import { describe, expect, it } from 'vitest';
import type { Excursion, ExcursionLeg, Spot } from '../api/types';
import { buildTourSerpentineRows } from './tourSerpentine';

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
