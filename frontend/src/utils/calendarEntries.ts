import type { CalendarEntry, Excursion, ScheduleItem, Spot, TodoItem, TravelItem, Trip } from '../api/types';
import { excursionStationKeys, resolveStations } from './excursionStations';
import { spotCategoryMeta } from './spotCategory';
import type { IconDef } from './icon';

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
      const stations = resolveStations(excursionStationKeys(excursion.spot_ids), spots, travelItems);
      return stations.length === 1 ? stations[0].icon : undefined;
    }
  }
  return undefined;
}

// Tabler-Pendant zu resolveScheduleItemIcon() oben (siehe CalendarEntry.iconDef, api/types.ts) -
// dieselbe Verknüpfungs-Logik, nur .tabler statt .icon von spotCategoryMeta()/den
// ExcursionStation-Objekten gelesen.
export function resolveScheduleItemIconDef(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[],
): IconDef | undefined {
  if (item.spot_id != null) {
    const spot = spots.find((s) => s.id === item.spot_id);
    if (spot) return spotCategoryMeta(spot.category).tabler;
  }
  if (item.idea_id != null) {
    const excursion = excursions.find((e) => e.id === item.idea_id);
    if (excursion) {
      const stations = resolveStations(excursionStationKeys(excursion.spot_ids), spots, travelItems);
      return stations.length === 1 ? stations[0].tabler : undefined;
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
  const linkedExcursion = item.idea_id != null ? excursions.find((e) => e.id === item.idea_id) : undefined;
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
    // Eine Tour mit gesetzter role (ehemalige Reise-Etappe, #176) bekommt stattdessen weiterhin die
    // eigene "Reise"-Kategorie (grün/✈️) - dieselbe Optik wie vor der Zusammenlegung, nur jetzt aus
    // demselben schedule_items-Eintrag abgeleitet statt aus einem eigenen, zweiten Kalender-Eintrag
    // (siehe entfernte buildTravelEntries()): jede Tour hat GENAU einen Kalender-Eintrag, sonst
    // erschien eine terminierte Reise-Etappe früher doppelt (einmal als Ausflug-, einmal als
    // Reise-Eintrag).
    category: linkedExcursion?.role ? 'travel' : linked ? 'excursion' : item.category,
    icon: resolveScheduleItemIcon(item, spots, excursions, travelItems),
    iconDef: resolveScheduleItemIconDef(item, spots, excursions, travelItems),
    ideaId: item.idea_id,
    spotId: item.spot_id,
    todoId: null,
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
      scheduleItem: null,
      done: !!t.done,
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
  ];
}
