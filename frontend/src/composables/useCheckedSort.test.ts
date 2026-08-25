import { describe, expect, it } from 'vitest';
import { sortWithDoneLast } from './useCheckedSort';

interface Item {
  id: number;
  done: boolean;
  order: number;
}

function item(id: number, done: boolean, order = 0): Item {
  return { id, done, order };
}

describe('sortWithDoneLast', () => {
  it('moves done items after not-done items', () => {
    const list = [item(1, true), item(2, false), item(3, true), item(4, false)];
    const sorted = sortWithDoneLast(list, (i) => i.done);
    expect(sorted.map((i) => i.id)).toEqual([2, 4, 1, 3]);
  });

  it('applies the comparator only within each done/not-done partition', () => {
    const list = [item(1, true, 2), item(2, false, 2), item(3, true, 1), item(4, false, 1)];
    const sorted = sortWithDoneLast(
      list,
      (i) => i.done,
      (a, b) => a.order - b.order
    );
    expect(sorted.map((i) => i.id)).toEqual([4, 2, 3, 1]);
  });

  it('returns an empty list unchanged', () => {
    expect(sortWithDoneLast<Item>([], (i) => i.done)).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const list = [item(1, true), item(2, false)];
    const original = [...list];
    sortWithDoneLast(list, (i) => i.done);
    expect(list).toEqual(original);
  });
});
