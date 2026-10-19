// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useScheduleItemDetail } from './useScheduleItemDetail';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import type { CalendarEntry, Excursion, ScheduleItem, Spot } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

const mockPush = vi.fn().mockResolvedValue(undefined);

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>();
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush,
    }),
  };
});

function createMockSpot(partial: Partial<Spot>): Spot {
  return partial as unknown as Spot;
}

function createMockScheduleItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return partial as unknown as ScheduleItem;
}

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return partial as unknown as Excursion;
}

describe('useScheduleItemDetail', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('EventSource', MockEventSource);
    mockPush.mockClear();
  });

  it('öffnet einen Spot in der Spot-Ansicht (group: spots), wenn ihm einfach nur ein Kalenderdatum zugeordnet wurde', () => {
    const spotsStore = useSpotsStore();
    const scheduleStore = useScheduleStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    const spot = createMockSpot({ id: 10, title: 'Museum', category: 'Kultur' });
    spotsStore.spots = [spot];

    const item = createMockScheduleItem({
      id: 100,
      trip_id: 1,
      date: '2026-07-15',
      spot_id: 10,
      title: 'Museumsbesuch',
    });
    scheduleStore.items = [item];
    scheduleStore.selectedItemId = 100;

    const entry: CalendarEntry = {
      key: 's-100',
      kind: 'schedule',
      date: '2026-07-15',
      endDate: '2026-07-15',
      time: null,
      endTime: null,
      title: 'Museumsbesuch',
      note: null,
      location: null,
      category: 'excursion',
      ideaId: null,
      spotId: 10,
      todoId: null,
      scheduleItem: item,
      done: false,
    };

    const detail = useScheduleItemDetail({
      allEntries: computed(() => [entry]),
      weatherEntriesFor: () => [],
    });

    detail.navigateToLinkedEntity();

    expect(mockPush).toHaveBeenCalledWith({
      path: '/trip/1/excursions',
      query: { group: 'spots' },
      hash: '#spot-10',
    });
  });

  it('öffnet eine Unterkunft immer in der Spot-Ansicht (group: spots)', () => {
    const spotsStore = useSpotsStore();
    const excursionsStore = useExcursionsStore();
    const scheduleStore = useScheduleStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    const accommodationSpot = createMockSpot({
      id: 20,
      title: 'Hotel Miramar',
      category: 'Unterkunft',
    });
    spotsStore.spots = [accommodationSpot];

    // Selbst wenn eine Tour diesen Spot an diesem Tag enthalten würde
    excursionsStore.excursions = [
      createMockExcursion({
        id: 5,
        title: 'Anreise',
        date: '2026-07-15',
        spot_ids: [20],
      }),
    ];

    const item = createMockScheduleItem({
      id: 101,
      trip_id: 1,
      date: '2026-07-15',
      spot_id: 20,
      title: 'Check-in Hotel',
    });
    scheduleStore.items = [item];
    scheduleStore.selectedItemId = 101;

    const entry: CalendarEntry = {
      key: 's-101',
      kind: 'schedule',
      date: '2026-07-15',
      endDate: '2026-07-15',
      time: null,
      endTime: null,
      title: 'Check-in Hotel',
      note: null,
      location: null,
      category: 'excursion',
      ideaId: null,
      spotId: 20,
      todoId: null,
      scheduleItem: item,
      done: false,
    };

    const detail = useScheduleItemDetail({
      allEntries: computed(() => [entry]),
      weatherEntriesFor: () => [],
    });

    detail.navigateToLinkedEntity();

    expect(mockPush).toHaveBeenCalledWith({
      path: '/trip/1/excursions',
      query: { group: 'spots' },
      hash: '#spot-20',
    });
  });

  it('öffnet den Spot in der Touren-Ansicht (group: tours), wenn das Datum aus einer hinterlegten Tour resultiert', () => {
    const spotsStore = useSpotsStore();
    const excursionsStore = useExcursionsStore();
    const scheduleStore = useScheduleStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    const spot = createMockSpot({ id: 30, title: 'Miradouro', category: 'Aussichtspunkt' });
    spotsStore.spots = [spot];

    excursionsStore.excursions = [
      createMockExcursion({
        id: 7,
        title: 'Panoramatour',
        date: '2026-07-15',
        spot_ids: [30, 31],
      }),
    ];

    const item = createMockScheduleItem({
      id: 102,
      trip_id: 1,
      date: '2026-07-15',
      spot_id: 30,
      title: 'Miradouro Aussicht',
    });
    scheduleStore.items = [item];
    scheduleStore.selectedItemId = 102;

    const entry: CalendarEntry = {
      key: 's-102',
      kind: 'schedule',
      date: '2026-07-15',
      endDate: '2026-07-15',
      time: null,
      endTime: null,
      title: 'Miradouro Aussicht',
      note: null,
      location: null,
      category: 'excursion',
      ideaId: null,
      spotId: 30,
      todoId: null,
      scheduleItem: item,
      done: false,
    };

    const detail = useScheduleItemDetail({
      allEntries: computed(() => [entry]),
      weatherEntriesFor: () => [],
    });

    detail.navigateToLinkedEntity();

    expect(mockPush).toHaveBeenCalledWith({
      path: '/trip/1/excursions',
      query: { group: 'tours' },
      hash: '#spot-30',
    });
  });

  it('öffnet eine verknüpfte Tour in der Touren-Ansicht (group: tours)', () => {
    const excursionsStore = useExcursionsStore();
    const scheduleStore = useScheduleStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    excursionsStore.excursions = [
      createMockExcursion({
        id: 12,
        title: 'Wanderung',
        date: '2026-07-16',
        spot_ids: [],
      }),
    ];

    const item = createMockScheduleItem({
      id: 103,
      trip_id: 1,
      date: '2026-07-16',
      idea_id: 12,
      title: 'Wanderung',
    });
    scheduleStore.items = [item];
    scheduleStore.selectedItemId = 103;

    const entry: CalendarEntry = {
      key: 's-103',
      kind: 'schedule',
      date: '2026-07-16',
      endDate: '2026-07-16',
      time: null,
      endTime: null,
      title: 'Wanderung',
      note: null,
      location: null,
      category: 'excursion',
      ideaId: 12,
      spotId: null,
      todoId: null,
      scheduleItem: item,
      done: false,
    };

    const detail = useScheduleItemDetail({
      allEntries: computed(() => [entry]),
      weatherEntriesFor: () => [],
    });

    detail.navigateToLinkedEntity();

    expect(mockPush).toHaveBeenCalledWith({
      path: '/trip/1/excursions',
      query: { group: 'tours' },
      hash: '#excursion-12',
    });
  });

  it('openAccommodationSpot öffnet eine Unterkunft per Badge immer in der Spot-Ansicht (group: spots)', () => {
    const tripStore = useTripStore();
    const drawers = useDrawersStore();
    tripStore.currentTripId = 1;

    const detail = useScheduleItemDetail({
      allEntries: computed(() => []),
      weatherEntriesFor: () => [],
    });

    detail.openAccommodationSpot(42);

    expect(drawers.mapFocusKey).toBe('spot-42');
    expect(drawers.calendarOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith({
      path: '/trip/1/excursions',
      query: { group: 'spots' },
      hash: '#spot-42',
    });
  });
});
