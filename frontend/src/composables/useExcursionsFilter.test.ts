import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import { useExcursionsFilter } from './useExcursionsFilter';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import type { Excursion, ScheduleItem, Spot } from '../api/types';

function createMockSpot(partial: Partial<Spot>): Spot {
  return partial as unknown as Spot;
}

function createMockScheduleItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return partial as unknown as ScheduleItem;
}

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return partial as unknown as Excursion;
}

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('useExcursionsFilter', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
  });

  const mockRoute = {
    path: '/trip/1/excursions',
    query: {},
    hash: '',
  } as unknown as RouteLocationNormalizedLoaded;

  const mockRouter = {
    replace: () => Promise.resolve(),
  } as unknown as Router;

  it('erkennt aktive Filter und setzt sie sauber zurück', () => {
    const filter = useExcursionsFilter({
      route: mockRoute,
      router: mockRouter,
    });

    expect(filter.hasActiveFilters.value).toBe(false);

    filter.searchQuery.value = 'Strand';
    expect(filter.hasActiveFilters.value).toBe(true);

    filter.clearAllFilters();
    expect(filter.hasActiveFilters.value).toBe(false);
    expect(filter.searchQuery.value).toBe('');
    expect(filter.categoryFilter.value).toEqual([]);
    expect(filter.statusFilter.value).toEqual([]);
    expect(filter.tourRoleFilter.value).toEqual([]);
  });

  it('filtert Spots nach Kategorie, Status und Suchbegriff', () => {
    const spotsStore = useSpotsStore();
    const scheduleStore = useScheduleStore();

    spotsStore.spots = [
      createMockSpot({
        id: 1,
        trip_id: 1,
        title: 'Traumstrand',
        category: 'Strand',
        lat: 10,
        lng: 10,
      }),
      createMockSpot({
        id: 2,
        trip_id: 1,
        title: 'Berggipfel',
        category: 'Aussichtspunkt',
        lat: 20,
        lng: 20,
      }),
    ];

    // Spot 1 ist geplant über Kalender-Item
    scheduleStore.items = [
      createMockScheduleItem({
        id: 10,
        trip_id: 1,
        date: '2026-06-15',
        title: 'Strandtag',
        spot_id: 1,
      }),
    ];

    const filter = useExcursionsFilter({
      route: mockRoute,
      router: mockRouter,
    });

    expect(filter.filteredSpotItems.value.length).toBe(2);

    // Filter nach Kategorie
    filter.categoryFilter.value = ['Strand'];
    expect(filter.filteredSpotItems.value.length).toBe(1);
    expect(filter.filteredSpotItems.value[0].spot.title).toBe('Traumstrand');

    // Filter nach Status 'unplanned' schließt Spot 1 aus
    filter.categoryFilter.value = [];
    filter.statusFilter.value = ['unplanned'];
    expect(filter.filteredSpotItems.value.length).toBe(1);
    expect(filter.filteredSpotItems.value[0].spot.title).toBe('Berggipfel');

    // Suche
    filter.statusFilter.value = [];
    filter.searchQuery.value = 'berg';
    expect(filter.filteredSpotItems.value.length).toBe(1);
    expect(filter.filteredSpotItems.value[0].spot.title).toBe('Berggipfel');
  });

  it('formuliert die grammatikalisch passende Bezeichnung der aktiven Filterquelle', () => {
    const filter = useExcursionsFilter({
      route: mockRoute,
      router: mockRouter,
    });

    filter.searchQuery.value = 'Café';
    expect(filter.tourFilterReason()).toBe('den Suchfilter');

    filter.clearAllFilters();
    filter.categoryFilter.value = ['Essen'];
    expect(filter.tourFilterReason()).toBe('den Kategorie-/Status-Filter');

    filter.searchQuery.value = 'Café';
    expect(filter.tourFilterReason()).toBe('aktive Filter');
  });

  it('ermittelt getTourTotalSpotsCount und Filter-Status für Touren', () => {
    const spotsStore = useSpotsStore();
    spotsStore.spots = [
      createMockSpot({ id: 1, trip_id: 1, title: 'Spot A', category: 'Kultur' }),
      createMockSpot({ id: 2, trip_id: 1, title: 'Spot B', category: 'Kultur' }),
    ];

    const filter = useExcursionsFilter({
      route: mockRoute,
      router: mockRouter,
    });

    const excursion = createMockExcursion({
      id: 100,
      trip_id: 1,
      title: 'Stadtrundgang',
      spot_ids: [1, 2],
    });

    expect(filter.getTourTotalSpotsCount(excursion)).toBe(2);

    // Keine aktiven Filter -> nicht gefiltert
    expect(filter.isTourPartiallyFiltered(excursion, 1)).toBe(false);

    filter.categoryFilter.value = ['Natur'];
    // 0 von 2 Spots sichtbar mit aktivem Filter -> AllSpotsFiltered
    expect(filter.isTourAllSpotsFiltered(excursion, 0)).toBe(true);
    // 1 von 2 Spots sichtbar mit aktivem Filter -> PartiallyFiltered
    expect(filter.isTourPartiallyFiltered(excursion, 1)).toBe(true);
  });
});
