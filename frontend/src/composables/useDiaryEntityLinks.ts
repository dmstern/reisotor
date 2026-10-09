import { computed } from 'vue';
import type { DiaryEntry, Excursion, Spot } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { buildDayStations } from '../utils/dayStations';

export function useDiaryEntityLinks() {
  const tripStore = useTripStore();
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
    return (
      scheduleStore.items.some((i) => i.spot_id === spotId && i.date === dateStr) ||
      excursionsStore.excursions.some((e) => e.date === dateStr && e.spot_ids.includes(spotId))
    );
  }

  function pickerSpots(dateStr: string): Spot[] {
    const matching = spotsStore.spots.filter((s) => spotAlreadyPlanned(s.id, dateStr));
    const rest = spotsStore.spots.filter((s) => !spotAlreadyPlanned(s.id, dateStr));
    return [...matching, ...rest];
  }

  function excursionsForEntry(entry: DiaryEntry): Excursion[] {
    return entry.excursion_ids
      .map((id) => excursionsStore.excursions.find((e) => e.id === id))
      .filter((e): e is Excursion => !!e);
  }

  function spotsForEntry(entry: DiaryEntry): Spot[] {
    return entry.spot_ids
      .map((id) => spotsStore.spots.find((s) => s.id === id))
      .filter((s): s is Spot => !!s);
  }

  function toggleSpot(spotId: number, target: { spot_ids: number[] }) {
    const idx = target.spot_ids.indexOf(spotId);
    if (idx === -1) target.spot_ids.push(spotId);
    else target.spot_ids.splice(idx, 1);
  }

  async function markLinkedAsDone(excursionIds: number[], spotIds: number[], date: string) {
    const tripId = tripStore.currentTripId;
    try {
      await Promise.all([
        ...excursionIds.map(async (id) => {
          const excursion = excursionsStore.excursions.find((e) => e.id === id);
          if (excursion && !excursion.date) await excursionsStore.setDate(id, date);
          await excursionsStore.setDone(id, true);
        }),
        ...spotIds.map(async (id) => {
          if (tripId != null && !spotAlreadyPlanned(id, date)) {
            const spot = spotsStore.spots.find((s) => s.id === id);
            if (spot) await scheduleStore.setSpotDate(id, tripId, spot.title, date);
          }
          await spotsStore.setDone(id, true);
        }),
      ]);
    } catch {
      // Best effort - der Tagebucheintrag selbst ist bereits gespeichert
    }
  }

  function hasMapContent(entry: DiaryEntry): boolean {
    if (entry.spot_ids && entry.spot_ids.length > 0) return true;
    if (entry.excursion_ids && entry.excursion_ids.length > 0) return true;
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
  };
}
