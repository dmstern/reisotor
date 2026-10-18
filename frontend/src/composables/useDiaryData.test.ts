// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDiaryData } from './useDiaryData';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('useDiaryData', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('sortEntries sorts correctly without throwing when entry.date is null or undefined', () => {
    const { entries, sortEntries } = useDiaryData({ tripId: 1 });

    entries.value = [
      {
        id: 1,
        trip_id: 1,
        author_id: 1,
        date: null as unknown as string,
        created_at: '2026-07-01T10:00:00Z',
        title: 'Legacy without date',
        content: 'Test',
        content_format: 'html',
        images: [],
        excursion_ids: [],
        spot_ids: [],
        editor_ids: [],
        is_draft: 0,
        updated_at: null,
      },
      {
        id: 2,
        trip_id: 1,
        author_id: 1,
        date: '2026-07-03',
        created_at: '2026-07-03T10:00:00Z',
        title: 'Newer entry',
        content: 'Test',
        content_format: 'html',
        images: [],
        excursion_ids: [],
        spot_ids: [],
        editor_ids: [],
        is_draft: 0,
        updated_at: null,
      },
      {
        id: 3,
        trip_id: 1,
        author_id: 1,
        date: '2026-07-02',
        created_at: '2026-07-02T10:00:00Z',
        title: 'Middle entry',
        content: 'Test',
        content_format: 'html',
        images: [],
        excursion_ids: [],
        spot_ids: [],
        editor_ids: [],
        is_draft: 0,
        updated_at: null,
      },
    ];

    expect(() => sortEntries()).not.toThrow();
    expect(entries.value.map((e) => e.id)).toEqual([2, 3, 1]);
  });
});
