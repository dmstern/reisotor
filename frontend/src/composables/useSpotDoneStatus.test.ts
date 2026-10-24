// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useSpotDoneStatus } from './useSpotDoneStatus';
import { useScheduleStore } from '../stores/schedule';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion, ScheduleItem, Spot } from '../api/types';

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

function createMockSpot(partial: Partial<Spot>): Spot {
  return {
    id: 1,
    trip_id: 10,
    title: 'Test Spot',
    category: 'Aktivität',
    done: 0,
    ...partial,
  } as Spot;
}

function createMockScheduleItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return partial as unknown as ScheduleItem;
}

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 1,
    trip_id: 10,
    title: 'Test Tour',
    spot_ids: [],
    ...partial,
  } as Excursion;
}

describe('useSpotDoneStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
  });

  it('berechnet Erledigt-Status für ungeplanten Spot anhand spot.done', () => {
    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>(null);

    const { isSpotDone, isSpotPartiallyDone, totalItemsCount } = useSpotDoneStatus({
      spot,
      scheduledDate,
    });

    expect(totalItemsCount.value).toBe(0);
    expect(isSpotDone.value).toBe(false);
    expect(isSpotPartiallyDone.value).toBe(false);

    spot.value = createMockSpot({ id: 1, done: 1 });
    expect(isSpotDone.value).toBe(true);
  });

  it('berechnet Erledigt- und Teil-Erledigt-Status für mehrere geplante Termine', () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      createMockScheduleItem({ id: 101, spot_id: 1, date: '2026-07-02', done: 0, trip_id: 10 }),
      createMockScheduleItem({ id: 102, spot_id: 1, date: '2026-07-01', done: 1, trip_id: 10 }),
    ];

    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>('2026-07-01');

    const {
      scheduledItemsForSpot,
      totalItemsCount,
      doneItemsCount,
      allItemsDone,
      isSpotDone,
      isSpotPartiallyDone,
    } = useSpotDoneStatus({ spot, scheduledDate });

    // Sortiert nach Datum: 2026-07-01 vor 2026-07-02
    expect(scheduledItemsForSpot.value.map((i) => i.id)).toEqual([102, 101]);
    expect(totalItemsCount.value).toBe(2);
    expect(doneItemsCount.value).toBe(1);
    expect(allItemsDone.value).toBe(false);
    expect(isSpotPartiallyDone.value).toBe(true);
    expect(isSpotDone.value).toBe(false);

    // Beide erledigt
    scheduleStore.items = scheduleStore.items.map((i) => ({ ...i, done: 1 }));
    expect(allItemsDone.value).toBe(true);
    expect(isSpotDone.value).toBe(true);
    expect(isSpotPartiallyDone.value).toBe(false);
  });

  it('hakt bei 1 Termin diesen direkt ab', async () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      createMockScheduleItem({ id: 101, spot_id: 1, date: '2026-07-01', done: 0, trip_id: 10 }),
    ];
    const setDoneSpy = vi.spyOn(scheduleStore, 'setDone').mockResolvedValue({ done: true });

    const spot = ref(createMockSpot({ id: 1 }));
    const scheduledDate = ref<string | null>('2026-07-01');

    const { onToggleDone } = useSpotDoneStatus({ spot, scheduledDate });

    await onToggleDone();
    expect(setDoneSpy).toHaveBeenCalledWith(101, true);
  });

  it('hakt bei 0 Terminen mit scheduledDate den SpotStore direkt ab', async () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [];
    const spotsStore = useSpotsStore();
    const spotDoneSpy = vi.spyOn(spotsStore, 'setDone').mockResolvedValue();

    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>('2026-07-01');

    const { onToggleDone } = useSpotDoneStatus({ spot, scheduledDate });

    await onToggleDone();
    expect(spotDoneSpy).toHaveBeenCalledWith(1, true);
  });

  it('öffnet Popover bei >1 Terminen bzw. bei ungeplanten Spots', async () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [];

    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>(null);

    const { onToggleDone, unplannedPopoverOpen, datesPopoverOpen } = useSpotDoneStatus({
      spot,
      scheduledDate,
    });

    // Ungeplant -> Unplanned Popover öffnet
    await onToggleDone();
    expect(unplannedPopoverOpen.value).toBe(true);
    expect(datesPopoverOpen.value).toBe(false);

    // Multi-Termine -> Dates Popover öffnet
    scheduleStore.items = [
      createMockScheduleItem({ id: 1, spot_id: 1, date: '2026-07-01', trip_id: 10 }),
      createMockScheduleItem({ id: 2, spot_id: 1, date: '2026-07-02', trip_id: 10 }),
    ];
    await onToggleDone();
    expect(datesPopoverOpen.value).toBe(true);
  });

  it('submitUnplannedDone ruft scheduleStore.setSpotDate auf', async () => {
    const scheduleStore = useScheduleStore();
    const setSpotDateSpy = vi.spyOn(scheduleStore, 'setSpotDate').mockResolvedValue(undefined);
    const tripStore = useTripStore();
    tripStore.currentTripId = 10;

    const spot = ref(createMockSpot({ id: 1, title: 'Museum' }));
    const scheduledDate = ref<string | null>(null);

    const { unplannedDoneDate, submitUnplannedDone, unplannedPopoverOpen } = useSpotDoneStatus({
      spot,
      scheduledDate,
    });

    unplannedPopoverOpen.value = true;
    unplannedDoneDate.value = '2026-07-10';

    await submitUnplannedDone();

    expect(setSpotDateSpy).toHaveBeenCalledWith(1, 10, 'Museum', '2026-07-10', true);
    expect(unplannedPopoverOpen.value).toBe(false);
  });

  it('openCalendarConfirmDone triggert drawers.startPendingSchedule mit confirm-done', () => {
    const drawers = useDrawersStore();
    const pendingSpy = vi.spyOn(drawers, 'startPendingSchedule');

    const spot = ref(createMockSpot({ id: 42 }));
    const scheduledDate = ref<string | null>(null);

    const { openCalendarConfirmDone, unplannedPopoverOpen } = useSpotDoneStatus({
      spot,
      scheduledDate,
    });

    unplannedPopoverOpen.value = true;
    openCalendarConfirmDone();

    expect(unplannedPopoverOpen.value).toBe(false);
    expect(pendingSpy).toHaveBeenCalledWith('spot', 42, 'confirm-done');
  });

  it('erfasst und zählt Daten aus zwei Touren (z. B. Hinflug und Rückflug)', async () => {
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      createMockExcursion({
        id: 201,
        title: 'Hinflug nach Lissabon',
        date: '2026-11-07',
        spot_ids: [1],
        done: 0,
      }),
      createMockExcursion({
        id: 202,
        title: 'Rückflug nach Berlin',
        date: '2026-11-17',
        spot_ids: [1],
        done: 0,
      }),
    ];

    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue(undefined);
    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>('2026-11-07');

    const {
      scheduledItemsForSpot,
      totalItemsCount,
      doneItemsCount,
      isSpotDone,
      isSpotPartiallyDone,
      toggleScheduledItemDone,
    } = useSpotDoneStatus({ spot, scheduledDate });

    expect(totalItemsCount.value).toBe(2);
    expect(scheduledItemsForSpot.value.map((i) => i.date)).toEqual(['2026-11-07', '2026-11-17']);
    expect(scheduledItemsForSpot.value[0].title).toBe('Hinflug nach Lissabon');
    expect(scheduledItemsForSpot.value[1].title).toBe('Rückflug nach Berlin');
    expect(doneItemsCount.value).toBe(0);
    expect(isSpotDone.value).toBe(false);

    // Hinflug als erledigt markieren
    await toggleScheduledItemDone(scheduledItemsForSpot.value[0]);
    expect(setDoneSpy).toHaveBeenCalledWith(201, true);

    // Wenn Hinflug erledigt ist
    excursionsStore.excursions = [
      { ...excursionsStore.excursions[0], done: 1 },
      excursionsStore.excursions[1],
    ];
    expect(doneItemsCount.value).toBe(1);
    expect(isSpotPartiallyDone.value).toBe(true);
    expect(isSpotDone.value).toBe(false);

    // Wenn beide Touren erledigt sind
    excursionsStore.excursions = [
      excursionsStore.excursions[0],
      { ...excursionsStore.excursions[1], done: 1 },
    ];
    expect(doneItemsCount.value).toBe(2);
    expect(isSpotPartiallyDone.value).toBe(false);
    expect(isSpotDone.value).toBe(true);
  });

  it('erfasst und zählt gemischte Daten aus Tour und Kalendertermin', async () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      createMockScheduleItem({ id: 101, spot_id: 1, date: '2026-10-27', done: 0, trip_id: 10 }),
    ];
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      createMockExcursion({
        id: 201,
        title: 'Panoramatour',
        date: '2026-11-08',
        spot_ids: [1],
        done: 0,
      }),
    ];

    const schedSetDoneSpy = vi.spyOn(scheduleStore, 'setDone').mockResolvedValue({ done: true });
    const excSetDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue(undefined);

    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>('2026-10-27');

    const { scheduledItemsForSpot, totalItemsCount, toggleScheduledItemDone } = useSpotDoneStatus({
      spot,
      scheduledDate,
    });

    expect(totalItemsCount.value).toBe(2);
    expect(scheduledItemsForSpot.value.map((i) => i.date)).toEqual(['2026-10-27', '2026-11-08']);
    expect(scheduledItemsForSpot.value[0].type).toBe('schedule');
    expect(scheduledItemsForSpot.value[1].type).toBe('tour');

    // Togglen des Termins
    await toggleScheduledItemDone(scheduledItemsForSpot.value[0]);
    expect(schedSetDoneSpy).toHaveBeenCalledWith(101, true);

    // Togglen der Tour
    await toggleScheduledItemDone(scheduledItemsForSpot.value[1]);
    expect(excSetDoneSpy).toHaveBeenCalledWith(201, true);
  });
});
