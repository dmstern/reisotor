import { computed } from 'vue';
import type { DiaryEntry, Excursion, Spot } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { buildDayStations } from '../utils/dayStations';

export function useDiaryEntityLinks() {
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const drawers = useDrawersStore();

  const travelItems = computed(() =>
    deriveTravelItems(excursionsStore.excursions, spotsStore.spots)
  );

  function pickerExcursions(dateStr: string): Excursion[] {
    const matching = excursionsStore.excursions.filter((e) => e.date === dateStr);
    const rest = excursionsStore.excursions.filter((e) => e.date !== dateStr);
    return [...matching, ...rest];
  }

  function spotAlreadyPlanned(spotId: number, dateStr: string): boolean {
    const spot = spotsStore.spots.find((targetSpot) => targetSpot.id === spotId);
    const hasOwnDate = Boolean(spot?.dates?.some((entry) => entry.date === dateStr));

    if (hasOwnDate) {
      return true;
    }

    return excursionsStore.excursions.some(
      (excursion) => excursion.date === dateStr && excursion.spot_ids.includes(spotId)
    );
  }

  function getSpotScheduledDates(spotId: number): string[] {
    const dates = new Set<string>();
    const spot = spotsStore.spots.find((targetSpot) => targetSpot.id === spotId);

    for (const entry of spot?.dates ?? []) {
      if (entry.date) {
        dates.add(entry.date);
      }
    }

    for (const excursion of excursionsStore.excursions) {
      if (excursion.date && (excursion.spot_ids ?? []).includes(spotId)) {
        dates.add(excursion.date);
      }
    }

    return Array.from(dates).sort();
  }

  function spotDateMismatch(spotId: number, targetDate?: string): boolean {
    if (!targetDate) {
      return false;
    }

    const dates = getSpotScheduledDates(spotId);
    return dates.length > 0 && !dates.includes(targetDate);
  }

  function excursionDateMismatch(excursion: Excursion, targetDate?: string): boolean {
    if (!targetDate || !excursion.date) {
      return false;
    }

    return excursion.date !== targetDate;
  }

  function pickerSpots(dateStr: string): Spot[] {
    const matching = spotsStore.spots.filter((spot) => spotAlreadyPlanned(spot.id, dateStr));
    const rest = spotsStore.spots.filter((spot) => !spotAlreadyPlanned(spot.id, dateStr));
    return [...matching, ...rest];
  }

  function excursionsForEntry(entry: DiaryEntry): Excursion[] {
    return (entry.excursion_ids ?? [])
      .map((id) => excursionsStore.excursions.find((e) => e.id === id))
      .filter((e): e is Excursion => !!e);
  }

  function spotsForEntry(entry: DiaryEntry): Spot[] {
    return (entry.spot_ids ?? [])
      .map((id) => spotsStore.spots.find((spot) => spot.id === id))
      .filter((spot): spot is Spot => !!spot);
  }

  function toggleSpot(spotId: number, target: { spot_ids: number[] }) {
    const idx = target.spot_ids.indexOf(spotId);

    if (idx === -1) {
      target.spot_ids.push(spotId);
    } else {
      target.spot_ids.splice(idx, 1);
    }
  }

  async function markLinkedAsDone(
    excursionIds: number[],
    spotIds: number[],
    date: string,
    moveSpotIds: number[] = []
  ) {
    try {
      await Promise.all([
        ...excursionIds.map(async (id) => {
          const excursion = excursionsStore.excursions.find((e) => e.id === id);

          if (excursion && !excursion.date) {
            await excursionsStore.setDate(id, date);
          }

          await excursionsStore.setDone(id, true);
        }),
        ...spotIds.map(async (id) => {
          const spot = spotsStore.spots.find((targetSpot) => targetSpot.id === id);
          const existingDates = spot?.dates ?? [];
          const hasDates = existingDates.length > 0;

          if (date && moveSpotIds.includes(id)) {
            if (existingDates.length === 1 && existingDates[0].date !== date) {
              await spotsStore.updateDate(id, existingDates[0].id, { date, done: true });
              return;
            }

            await spotsStore.addDate(id, date, true);
            return;
          }

          if (date && !hasDates) {
            await spotsStore.addDate(id, date, true);
            return;
          }

          const matchingDateEntry =
            date && existingDates.length > 1
              ? existingDates.find((entry) => entry.date === date)
              : undefined;

          if (matchingDateEntry) {
            await spotsStore.updateDate(id, matchingDateEntry.id, { done: true });
            return;
          }

          await spotsStore.setDone(id, true);
        }),
      ]);
    } catch {
      // Best effort - der Tagebucheintrag selbst ist bereits gespeichert
    }
  }

  function hasMapContent(entry: DiaryEntry): boolean {
    if (entry.spot_ids && entry.spot_ids.length > 0) {
      return true;
    }

    if (entry.excursion_ids && entry.excursion_ids.length > 0) {
      return true;
    }

    const stations = buildDayStations(
      entry.date,
      scheduleStore.items,
      excursionsStore.excursions,
      travelItems.value,
      spotsStore.spots
    );
    return stations.length > 0;
  }

  function showEntryDayOnMap(entry: DiaryEntry) {
    drawers.focusMapOnDate(entry.date);
  }

  return {
    travelItems,
    pickerExcursions,
    pickerSpots,
    spotAlreadyPlanned,
    excursionsForEntry,
    spotsForEntry,
    toggleSpot,
    markLinkedAsDone,
    hasMapContent,
    showEntryDayOnMap,
    getSpotScheduledDates,
    spotDateMismatch,
    excursionDateMismatch,
  };
}
