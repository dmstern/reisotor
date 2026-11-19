import { computed, ref, watch } from 'vue';
import type { CalendarEntry, Spot } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useTodosStore } from '../stores/todos';
import { useDiaryStore } from '../stores/diary';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useWeatherProviderStore } from '../stores/weatherProvider';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { buildAllEntries } from '../utils/calendarEntries';
import { fetchWeatherForecast, type DailyWeather } from '../utils/weather';
import {
  collectWeatherLocations,
  dayWeatherEntries,
  type DayWeatherEntry,
} from '../utils/dayWeather';

/**
 * Kapselt das Laden, Synchronisieren und Vorhalten sämtlicher Kalenderdaten:
 * Manuelle Termine, direkte Projektionen (Spots, Touren, Tagebuch, Todos, Unterkünfte)
 * und standortabhängige Wettervorhersagen.
 */
export function useCalendarData() {
  const tripStore = useTripStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const todosStore = useTodosStore();
  const diaryStore = useDiaryStore();
  const drawers = useDrawersStore();
  const liveSync = useLiveSyncStore();
  const weatherProvider = useWeatherProviderStore();

  const trip = computed(() => tripStore.currentTrip);
  const accommodations = computed(() =>
    spotsStore.spots.filter((spot) => spot.category === 'Unterkunft')
  );
  const todos = computed(() => todosStore.items);
  const travelItems = computed(() =>
    deriveTravelItems(excursionsStore.excursions, spotsStore.spots)
  );
  const loading = ref(true);

  const home = computed(() => {
    const homeSpot = spotsStore.spots.find(
      (spot) => spot.is_home && spot.lat != null && spot.lng != null
    );
    return homeSpot ? { lat: homeSpot.lat as number, lng: homeSpot.lng as number } : null;
  });

  const weatherByLocation = ref<Map<string, DailyWeather[]>>(new Map());

  async function loadAll() {
    const tripId = tripStore.currentTripId;

    if (tripId == null) {
      return;
    }

    await Promise.all([
      todosStore.load(tripId),
      diaryStore.load(),
      spotsStore.load(),
      scheduleStore.load(),
    ]);
  }

  async function loadWeather() {
    const locations = collectWeatherLocations(trip.value, home.value, accommodations.value);
    const results = await Promise.allSettled(
      locations.map(async (loc) => ({
        key: loc.key,
        days: await fetchWeatherForecast(loc.lat, loc.lng, weatherProvider.model),
      }))
    );
    const map = new Map<string, DailyWeather[]>();

    for (const result of results) {
      if (result.status === 'fulfilled') {
        map.set(result.value.key, result.value.days);
      }
    }

    weatherByLocation.value = map;
  }

  function accommodationsForDate(date: string): Spot[] {
    return accommodations.value.filter(
      (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date
    );
  }

  function weatherEntriesFor(date: string): DayWeatherEntry[] {
    return dayWeatherEntries(date, trip.value, accommodations.value, weatherByLocation.value);
  }

  const allEntries = computed(() =>
    buildAllEntries({
      items: scheduleStore.items,
      trip: trip.value,
      todos: todos.value,
      travelItems: travelItems.value,
      excursions: excursionsStore.excursions,
      spots: spotsStore.spots,
      diaryEntries: diaryStore.entries,
    })
  );

  function entriesForDate(date: string): CalendarEntry[] {
    return allEntries.value
      .filter((e) => e.date <= date && date <= e.endDate)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  function entryDone(entry: CalendarEntry): boolean {
    if (entry.kind === 'todo') {
      return Boolean(todos.value.find((todo) => todo.id === entry.todoId)?.done);
    }

    return Boolean(entry.done);
  }

  async function toggleTodoDone(todoId: number) {
    const todo = todos.value.find((item) => item.id === todoId);

    if (!todo) {
      return;
    }

    await todosStore.toggleDone(todo);
  }

  watch(
    () => drawers.calendarOpen,
    (open) => {
      if (open) {
        liveSync.markSeen('schedule');
      }
    }
  );

  watch(
    () => tripStore.currentTripId,
    async () => {
      await loadAll();
      loadWeather();
    }
  );

  watch(
    () => drawers.locationsVersion,
    async () => {
      await loadAll();
      loadWeather();
    }
  );

  watch(() => weatherProvider.model, loadWeather);

  async function initCalendarData() {
    liveSync.markSeen('schedule');

    try {
      await loadAll();
    } catch {
      // Offline-Fallback
    }

    loadWeather();
  }

  return {
    trip,
    accommodations,
    todos,
    travelItems,
    loading,
    allEntries,
    weatherByLocation,
    loadAll,
    loadWeather,
    initCalendarData,
    accommodationsForDate,
    weatherEntriesFor,
    entriesForDate,
    entryDone,
    toggleTodoDone,
  };
}
