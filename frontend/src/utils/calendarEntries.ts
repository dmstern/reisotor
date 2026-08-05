import type { CalendarEntry, Excursion, ScheduleItem, Spot, TodoItem, TravelItem, Trip } from '../api/types';
import { resolveStations } from './excursionStations';
import { spotCategoryMeta } from './spotCategory';

// Icon-Override für einen mit Spot/Tour verknüpften Termin: bei einem verknüpften Spot dessen
// eigenes Kategorie-Icon, bei einer verknüpften Tour mit genau einer Spot-Station deren Icon
// (sonst das generische 🎒 aus SCHEDULE_CATEGORY_META). Eigene Funktion statt nur inline in
// scheduleItemToEntry, da ScheduleView.vue denselben Icon-Override auch für den Anzeige-Dialog
// braucht (dort existiert keine fertige CalendarEntry, nur das rohe ScheduleItem).
export function resolveScheduleItemIcon(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[],
): string | undefined {
  if (item.spot_id != null) {
    const spot = spots.find((s) => s.id === item.spot_id);
    if (spot) return spotCategoryMeta(spot.category).icon;
  }
  if (item.idea_id != null) {
    const excursion = excursions.find((e) => e.id === item.idea_id);
    if (excursion) {
      const stations = resolveStations(excursion.station_keys, spots, travelItems);
      return stations.length === 1 ? stations[0].icon : undefined;
    }
  }
  return undefined;
}

export function scheduleItemToEntry(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[],
): CalendarEntry {
  const linked = item.spot_id != null || item.idea_id != null;
  return {
    key: `s-${item.id}`,
    kind: 'schedule',
    date: item.date,
    endDate: item.end_date ?? item.date,
    time: item.time,
    endTime: item.end_time,
    title: item.title,
    note: item.note,
    location: item.location,
    // Mit Spot/Tour verknüpfte Termine übernehmen bewusst die "Ausflug"-Kategorie (einheitliche
    // orange Rahmenfarbe) statt einer eigenen – exakt dieselbe Optik, die verknüpfte Termine schon
    // vor der Einführung dieser Verknüpfung hatten (damals als eigenständige "Ausflug"-Einträge).
    category: linked ? 'excursion' : item.category,
    icon: resolveScheduleItemIcon(item, spots, excursions, travelItems),
    ideaId: item.idea_id,
    spotId: item.spot_id,
    todoId: null,
    travelId: null,
    scheduleItem: item,
    done: false,
  };
}

// Urlaub-Stammdaten erscheinen automatisch als (nicht editierbare) Kalender-Items der Kategorie
// "Urlaub" – synthetisch aus den Trip-Stammdaten erzeugt, nicht in schedule_items gespeichert (Batch 3).
export function buildTripEntries(trip: Trip | null): CalendarEntry[] {
  if (!trip) return [];
  const entries: CalendarEntry[] = [
    {
      key: 'trip-start',
      kind: 'trip',
      date: trip.start_date,
      endDate: trip.start_date,
      time: null,
      endTime: null,
      title: `Urlaub-Start: ${trip.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      spotId: null,
      todoId: null,
      travelId: null,
      scheduleItem: null,
      done: false,
    },
  ];
  if (trip.end_date !== trip.start_date) {
    entries.push({
      key: 'trip-end',
      kind: 'trip',
      date: trip.end_date,
      endDate: trip.end_date,
      time: null,
      endTime: null,
      title: `Urlaub-Ende: ${trip.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      spotId: null,
      todoId: null,
      travelId: null,
      scheduleItem: null,
      done: false,
    });
  }
  return entries;
}

// Aufgaben mit Fälligkeitsdatum erscheinen automatisch (nicht editierbar) im Kalender (Batch 9).
export function buildTodoEntries(todos: TodoItem[]): CalendarEntry[] {
  return todos
    .filter((t): t is TodoItem & { due_date: string } => !!t.due_date)
    .map((t) => ({
      key: `todo-${t.id}`,
      kind: 'todo' as const,
      date: t.due_date,
      endDate: t.due_date,
      time: null,
      endTime: null,
      title: t.title,
      note: t.note,
      location: null,
      category: 'todo' as const,
      ideaId: null,
      spotId: null,
      todoId: t.id,
      travelId: null,
      scheduleItem: null,
      done: !!t.done,
    }));
}

// Reise-Einträge (Flug/Zug/Bus/…) mit Datum erscheinen automatisch (nicht editierbar) im Kalender,
// analog zu Urlaub-Stammdaten und ToDos.
export function buildTravelEntries(travelItems: TravelItem[]): CalendarEntry[] {
  return travelItems
    .filter((t): t is TravelItem & { date: string } => !!t.date)
    .map((t) => ({
      key: `travel-${t.id}`,
      kind: 'travel' as const,
      date: t.date,
      endDate: t.date,
      time: t.departure_time,
      endTime: t.arrival_time,
      title: t.title,
      note: t.note,
      location: t.from_location && t.to_location ? `${t.from_location} → ${t.to_location}` : null,
      category: 'travel' as const,
      ideaId: null,
      spotId: null,
      todoId: null,
      travelId: t.id,
      scheduleItem: null,
      done: false,
    }));
}

export function buildAllEntries(
  items: ScheduleItem[],
  trip: Trip | null,
  todos: TodoItem[],
  travelItems: TravelItem[],
  excursions: Excursion[],
  spots: Spot[],
): CalendarEntry[] {
  return [
    ...items.map((item) => scheduleItemToEntry(item, spots, excursions, travelItems)),
    ...buildTripEntries(trip),
    ...buildTodoEntries(todos),
    ...buildTravelEntries(travelItems),
  ];
}
