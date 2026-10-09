// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useExcursionDoneStatus } from './useExcursionDoneStatus';
import { useExcursionsStore } from '../stores/excursions';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion, Trip } from '../api/types';

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

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 10,
    trip_id: 1,
    title: 'Wanderung',
    done: 0,
    date: null,
    spot_ids: [],
    ...partial,
  } as unknown as Excursion;
}

describe('useExcursionDoneStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
  });

  it('schaltet done von true auf false zurück (ohne Popover)', async () => {
    const excursionsStore = useExcursionsStore();
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();

    const excursion = ref(createMockExcursion({ done: 1, date: '2026-07-10' }));
    const { onToggleDone, unplannedPopoverOpen } = useExcursionDoneStatus({ excursion });

    await onToggleDone();

    expect(setDoneSpy).toHaveBeenCalledWith(10, false);
    expect(unplannedPopoverOpen.value).toBe(false);
  });

  it('markiert geplante Tour mit Datum direkt als done', async () => {
    const excursionsStore = useExcursionsStore();
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();

    const excursion = ref(createMockExcursion({ done: 0, date: '2026-07-10' }));
    const { onToggleDone, unplannedPopoverOpen } = useExcursionDoneStatus({ excursion });

    await onToggleDone();

    expect(setDoneSpy).toHaveBeenCalledWith(10, true);
    expect(unplannedPopoverOpen.value).toBe(false);
  });

  it('öffnet Popover für ungeplante Tour ohne Datum', async () => {
    const tripStore = useTripStore();
    tripStore.trips = [
      {
        id: 1,
        name: 'Sommerurlaub',
        destination: 'Österreich',
        start_date: '2026-07-01',
        end_date: '2026-07-15',
      } as unknown as Trip,
    ];
    tripStore.currentTripId = 1;

    const excursion = ref(createMockExcursion({ done: 0, date: null }));
    const { onToggleDone, unplannedPopoverOpen, unplannedDoneDate } = useExcursionDoneStatus({
      excursion,
    });

    const triggerEl = document.createElement('button');
    document.body.appendChild(triggerEl);
    const mockEvent = { currentTarget: triggerEl } as unknown as MouseEvent;

    await onToggleDone(mockEvent);

    expect(unplannedPopoverOpen.value).toBe(true);
    expect(unplannedDoneDate.value).toBeTruthy();
  });

  it('speichert Datum und markiert als done in submitUnplannedDone', async () => {
    const excursionsStore = useExcursionsStore();
    const setDateSpy = vi.spyOn(excursionsStore, 'setDate').mockResolvedValue();
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();

    const excursion = ref(createMockExcursion({ done: 0, date: null }));
    const { submitUnplannedDone, unplannedDoneDate, unplannedPopoverOpen } = useExcursionDoneStatus(
      {
        excursion,
      }
    );

    unplannedPopoverOpen.value = true;
    unplannedDoneDate.value = '2026-07-12';

    await submitUnplannedDone();

    expect(setDateSpy).toHaveBeenCalledWith(10, '2026-07-12');
    expect(setDoneSpy).toHaveBeenCalledWith(10, true);
    expect(unplannedPopoverOpen.value).toBe(false);
  });

  it('springt zur Kalender-Bestätigung in openCalendarConfirmDone ab', () => {
    const drawers = useDrawersStore();
    const startPendingSpy = vi.spyOn(drawers, 'startPendingSchedule');

    const excursion = ref(createMockExcursion({ done: 0, date: null }));
    const { openCalendarConfirmDone, unplannedPopoverOpen } = useExcursionDoneStatus({
      excursion,
    });

    unplannedPopoverOpen.value = true;
    openCalendarConfirmDone();

    expect(unplannedPopoverOpen.value).toBe(false);
    expect(startPendingSpy).toHaveBeenCalledWith('excursion', 10, 'confirm-done');
  });
});
