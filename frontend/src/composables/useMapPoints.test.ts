// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { computed, ref } from 'vue';
import { useMapPoints } from './useMapPoints';
import { useSpotsStore } from '../stores/spots';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { api } from '../api/client';
import type { ScheduleItem, Spot, TravelItem, Trip } from '../api/types';

class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
vi.stubGlobal('EventSource', MockEventSource);

describe('useMapPoints', () => {
  beforeEach(() => {
    vi.spyOn(api, 'get').mockResolvedValue([]);
    setActivePinia(createPinia());
  });

  it('aggregates spots into points and filters out missing coordinates', () => {
    const spotsStore = useSpotsStore();
    spotsStore.spots = [
      {
        id: 1,
        trip_id: 1,
        title: 'Eiffelturm',
        category: 'Aktivität',
        lat: 48.8584,
        lng: 2.2945,
        done: 0,
        is_home: 0,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Ohne Koordinaten',
        category: 'Aktivität',
        lat: null,
        lng: null,
        done: 0,
        is_home: 0,
      },
    ] as unknown as Spot[];

    const travelItems = computed<TravelItem[]>(() => []);
    const scheduleItems = ref<ScheduleItem[]>([]);
    const excursionPhotoPoints = ref([]);
    const allTripPhotoPoints = ref([]);

    const { points, filteredPoints } = useMapPoints({
      travelItems,
      scheduleItems,
      excursionPhotoPoints,
      allTripPhotoPoints,
    });

    expect(points.value.length).toBe(1);
    expect(points.value[0].title).toBe('Eiffelturm');
    expect(points.value[0].origin).toBe('spot');
    expect(filteredPoints.value.length).toBe(1);
  });

  it('filters points by category and status', () => {
    const spotsStore = useSpotsStore();
    spotsStore.spots = [
      {
        id: 1,
        trip_id: 1,
        title: 'Spot 1',
        category: 'Aktivität',
        lat: 48.1,
        lng: 11.5,
        done: 1,
        is_home: 0,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Spot 2',
        category: 'Restaurant',
        lat: 48.2,
        lng: 11.6,
        done: 0,
        is_home: 0,
      },
    ] as unknown as Spot[];

    const travelItems = computed<TravelItem[]>(() => []);
    const scheduleItems = ref<ScheduleItem[]>([]);
    const excursionPhotoPoints = ref([]);
    const allTripPhotoPoints = ref([]);
    const categoryFilter = ref<string[]>(['Aktivität']);
    const statusFilter = ref<('planned' | 'unplanned' | 'done')[]>(['done']);

    const { filteredPoints } = useMapPoints({
      travelItems,
      scheduleItems,
      excursionPhotoPoints,
      allTripPhotoPoints,
      categoryFilter,
      statusFilter,
    });

    expect(filteredPoints.value.length).toBe(1);
    expect(filteredPoints.value[0].title).toBe('Spot 1');
  });

  it('computes vacationDays and dayHasContent correctly', () => {
    const tripStore = useTripStore();
    tripStore.trips = [
      {
        id: 1,
        name: 'Paris',
        start_date: '2026-06-01',
        end_date: '2026-06-03',
        destination: 'Paris',
        role: 'owner',
      },
    ] as unknown as Trip[];
    tripStore.currentTripId = 1;

    const travelItems = computed<TravelItem[]>(() => [
      {
        id: 1,
        date: '2026-06-01',
        type: 'flight',
        title: 'Flug',
      } as unknown as TravelItem,
    ]);
    const scheduleItems = ref<ScheduleItem[]>([]);
    const excursionPhotoPoints = ref([]);
    const allTripPhotoPoints = ref([]);

    const { vacationDays, dayHasContent, toggleDayFocus } = useMapPoints({
      travelItems,
      scheduleItems,
      excursionPhotoPoints,
      allTripPhotoPoints,
    });

    expect(vacationDays.value).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
    expect(dayHasContent('2026-06-01')).toBe(true);
    expect(dayHasContent('2026-06-02')).toBe(false);

    const drawers = useDrawersStore();
    toggleDayFocus('2026-06-01');
    expect(drawers.mapFocusDate).toBe('2026-06-01');
    toggleDayFocus('2026-06-01');
    expect(drawers.mapFocusDate).toBeNull();
  });
});
