// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useCalendarNavigation } from './useCalendarNavigation';
import type { Trip } from '../api/types';
import { toLocalDateString } from '../utils/dateFormat';

describe('useCalendarNavigation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function createTestTrip(partial: Partial<Trip> = {}): Trip {
    return {
      id: 1,
      name: 'Sommerurlaub',
      destination: 'Südtirol',
      start_date: '2026-08-01',
      end_date: '2026-08-15',
      user_id: 1,
      created_at: '2026-01-01',
      ...partial,
    } as Trip;
  }

  it('initialisiert die Navigation und setzt das heutige Datum', () => {
    const trip = ref<Trip | null>(createTestTrip());
    const nav = useCalendarNavigation({
      trip,
      entriesForDate: () => [],
      accommodationsForDate: () => [],
      weatherEntriesFor: () => [],
    });

    nav.initNavigation();

    const today = toLocalDateString(new Date());
    expect(nav.selectedDate.value).toBe(today);
    expect(nav.isTodayActive.value).toBe(true);
  });

  it('springt mit jumpToToday() zu heute, ohne Callbacks auszulösen', () => {
    const trip = ref<Trip | null>(createTestTrip());
    const nav = useCalendarNavigation({
      trip,
      entriesForDate: () => [],
      accommodationsForDate: () => [],
      weatherEntriesFor: () => [],
    });

    // Zunächst auf ein anderes Datum setzen
    nav.selectDay('2026-08-05');
    expect(nav.selectedDate.value).toBe('2026-08-05');

    nav.jumpToToday();

    const today = toLocalDateString(new Date());
    expect(nav.selectedDate.value).toBe(today);
    expect(nav.isTodayActive.value).toBe(true);
  });

  it('springt mit goToTripDates() zum Beginn der Reise', () => {
    const trip = ref<Trip | null>(
      createTestTrip({ start_date: '2026-08-01', end_date: '2026-08-15' })
    );
    const nav = useCalendarNavigation({
      trip,
      entriesForDate: () => [],
      accommodationsForDate: () => [],
      weatherEntriesFor: () => [],
    });

    nav.goToTripDates();

    expect(nav.selectedDate.value).toBe('2026-08-01');
    expect(nav.isTripActive.value).toBe(true);
  });

  it('erlaubt das Blättern von Seiten im Kalender', () => {
    const trip = ref<Trip | null>(createTestTrip());
    const nav = useCalendarNavigation({
      trip,
      entriesForDate: () => [],
      accommodationsForDate: () => [],
      weatherEntriesFor: () => [],
    });

    nav.goToDate('2026-08-01');
    const labelBefore = nav.visibleRangeLabel.value;
    expect(labelBefore).toContain('August 2026');

    nav.nextPage();
    expect(nav.visibleRangeLabel.value).toContain('September 2026');

    nav.prevPage();
    expect(nav.visibleRangeLabel.value).toContain('August 2026');
  });
});
