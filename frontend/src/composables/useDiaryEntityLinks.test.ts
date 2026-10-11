// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDiaryEntityLinks } from './useDiaryEntityLinks';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useTripStore } from '../stores/trip';
import type { Excursion, ScheduleItem, Spot, DiaryEntry } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve({ categories: [] });
      return Promise.resolve([]);
    }),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

describe('useDiaryEntityLinks', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
  });

  it('pickerExcursions sorts matching excursions first', () => {
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      { id: 1, title: 'Tour A', date: '2026-07-02' } as Excursion,
      { id: 2, title: 'Tour B', date: '2026-07-01' } as Excursion,
      { id: 3, title: 'Tour C', date: '2026-07-03' } as Excursion,
    ];

    const links = useDiaryEntityLinks();
    const sorted = links.pickerExcursions('2026-07-01');

    expect(sorted.map((e) => e.id)).toEqual([2, 1, 3]);
  });

  it('detects planned spots via schedule items or excursions', () => {
    const scheduleStore = useScheduleStore();
    const excursionsStore = useExcursionsStore();
    const spotsStore = useSpotsStore();

    spotsStore.spots = [
      { id: 10, title: 'Spot 10' } as Spot,
      { id: 20, title: 'Spot 20' } as Spot,
      { id: 30, title: 'Spot 30' } as Spot,
    ];

    scheduleStore.items = [{ id: 100, spot_id: 10, date: '2026-07-01' } as ScheduleItem];

    excursionsStore.excursions = [
      { id: 1, title: 'Tour', date: '2026-07-01', spot_ids: [20] } as Excursion,
    ];

    const links = useDiaryEntityLinks();
    expect(links.spotAlreadyPlanned(10, '2026-07-01')).toBe(true);
    expect(links.spotAlreadyPlanned(20, '2026-07-01')).toBe(true);
    expect(links.spotAlreadyPlanned(30, '2026-07-01')).toBe(false);

    const sortedSpots = links.pickerSpots('2026-07-01');
    expect(sortedSpots.slice(0, 2).map((s) => s.id)).toEqual([10, 20]);
    expect(sortedSpots[2].id).toBe(30);
  });

  it('toggles spot in target array', () => {
    const links = useDiaryEntityLinks();
    const target = { spot_ids: [10, 20] };

    links.toggleSpot(30, target);
    expect(target.spot_ids).toEqual([10, 20, 30]);

    links.toggleSpot(20, target);
    expect(target.spot_ids).toEqual([10, 30]);
  });

  it('detects map content and navigates to date on map', () => {
    const drawers = useDrawersStore();
    const focusSpy = vi.spyOn(drawers, 'focusMapOnDate').mockImplementation(() => {});

    const links = useDiaryEntityLinks();
    const entryWithSpots: DiaryEntry = {
      id: 1,
      trip_id: 1,
      author_id: 1,
      date: '2026-07-01',
      title: 'Tag 1',
      content: 'Hallo',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [10],
      editor_ids: [],
      is_draft: 0,
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    };

    expect(links.hasMapContent(entryWithSpots)).toBe(true);
    links.showEntryDayOnMap(entryWithSpots);
    expect(focusSpy).toHaveBeenCalledWith('2026-07-01');
  });
});
