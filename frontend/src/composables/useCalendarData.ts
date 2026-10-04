import { computed, ref, watch } from 'vue';
import { api } from '../api/client';
import type { CalendarEntry, Spot, TodoItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
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
 * Termine, Todos, Etappen, Unterkünfte und standortabhängige Wettervorhersagen.
 */
export function useCalendarData() {
  const tripStore = useTripStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const drawers = useDrawersStore();
  const liveSync = useLiveSyncStore();
  const weatherProvider = useWeatherProviderStore();

  const trip = computed(() => tripStore.currentTrip);
  const accommodations = computed(() =>
    spotsStore.spots.filter((s) => s.category === 'Unterkunft')
  );
  const todos = ref<TodoItem[]>([]);
  const travelItems = computed(() =>
    deriveTravelItems(excursionsStore.excursions, spotsStore.spots)
  );
  const loading = ref(true);

  const home = computed(() => {
    const p = spotsStore.spots.find((s) => s.is_home && s.lat != null && s.lng != null);
    return p ? { lat: p.lat as number, lng: p.lng as number } : null;
  });

  const weatherByLocation = ref<Map<string, DailyWeather[]>>(new Map());

  async function loadAll() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) return;
    const [todosRes] = await Promise.all([
      api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
      spotsStore.load(),
      scheduleStore.load(),
    ]);
    todos.value = todosRes;
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
      if (result.status === 'fulfilled') map.set(result.value.key, result.value.days);
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
    buildAllEntries(
      scheduleStore.items,
      trip.value,
      todos.value,
      travelItems.value,
      excursionsStore.excursions,
      spotsStore.spots
    )
  );

  function entriesForDate(date: string): CalendarEntry[] {
    return allEntries.value
      .filter((e) => e.date <= date && date <= e.endDate)
      .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  }

  function entryDone(entry: CalendarEntry): boolean {
    return !!todos.value.find((t) => t.id === entry.todoId)?.done;
  }

  async function toggleTodoDone(todoId: number) {
    const todo = todos.value.find((t) => t.id === todoId);
    if (!todo) return;
    const updated = await api.put<TodoItem>(`/todos/${todoId}`, {
      trip_id: tripStore.currentTripId,
      title: todo.title,
      assigned_to_user_id: todo.assigned_to_user_id,
      due_date: todo.due_date ?? undefined,
      period: todo.period ?? undefined,
      priority: todo.priority,
      note: todo.note ?? undefined,
      done: !todo.done,
    });
    const idx = todos.value.findIndex((t) => t.id === todoId);
    if (idx !== -1) todos.value[idx] = updated;
  }

  // Reactive Sync Watchers
  watch(
    () => drawers.calendarOpen,
    (open) => {
      if (open) liveSync.markSeen('schedule');
    }
  );

  watch(
    () => tripStore.currentTripId,
    async () => {
      await loadAll();
      loadWeather();
    }
  );

  watch(() => liveSync.domainVersion.todos, loadAll);

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
