import type {
  CalendarEntry,
  Excursion,
  ScheduleItem,
  Spot,
  TodoItem,
  TravelItem,
  Trip,
} from '../api/types';
import { excursionStationKeys, resolveStations } from './excursionStations';
import { spotCategoryMeta } from './spotCategory';
import type { IconDef } from './icon';

export interface CalendarLookupMaps {
  spotMap?: Map<number, Spot>;
  excursionMap?: Map<number, Excursion>;
  travelMap?: Map<number, TravelItem>;
}

// Löst sowohl emoji-Icon als auch Tabler-IconDef in einem einzigen Durchlauf auf,
// um redundante Array-Durchläufe und doppelte Stationen-Resolutions zu vermeiden.
export function resolveScheduleItemIcons(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[],
  maps?: CalendarLookupMaps,
  preloadedExcursion?: Excursion
): { icon: string | undefined; iconDef: IconDef | undefined } {
  if (item.spot_id != null) {
    const spot = maps?.spotMap
      ? maps.spotMap.get(item.spot_id)
      : spots.find((s) => s.id === item.spot_id);
    if (spot) {
      const meta = spotCategoryMeta(spot.category);
      return { icon: meta.icon, iconDef: meta.tabler };
    }
  }
  if (item.idea_id != null) {
    const excursion =
      preloadedExcursion ??
      (maps?.excursionMap
        ? maps.excursionMap.get(item.idea_id)
        : excursions.find((e) => e.id === item.idea_id));
    if (excursion) {
      const stations = resolveStations(
        excursionStationKeys(excursion.spot_ids),
        spots,
        travelItems,
        maps?.spotMap,
        maps?.travelMap
      );
      if (stations.length === 1) {
        return { icon: stations[0].icon, iconDef: stations[0].tabler };
      }
    }
  }
  return { icon: undefined, iconDef: undefined };
}

// Icon-Override für einen mit Spot/Tour verknüpften Termin: bei einem verknüpften Spot dessen
// eigenes Kategorie-Icon, bei einer verknüpften Tour mit genau einer Spot-Station deren Icon
// (sonst das generische 🎒 aus SCHEDULE_CATEGORY_META).
export function resolveScheduleItemIcon(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[]
): string | undefined {
  return resolveScheduleItemIcons(item, spots, excursions, travelItems).icon;
}

// Tabler-Pendant zu resolveScheduleItemIcon() oben (siehe CalendarEntry.iconDef, api/types.ts) -
// dieselbe Verknüpfungs-Logik, nur .tabler statt .icon.
export function resolveScheduleItemIconDef(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[]
): IconDef | undefined {
  return resolveScheduleItemIcons(item, spots, excursions, travelItems).iconDef;
}

export function scheduleItemToEntry(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[],
  maps?: CalendarLookupMaps
): CalendarEntry {
  const linked = item.spot_id != null || item.idea_id != null;
  const linkedExcursion =
    item.idea_id != null
      ? maps?.excursionMap
        ? maps.excursionMap.get(item.idea_id)
        : excursions.find((e) => e.id === item.idea_id)
      : undefined;
  const icons = resolveScheduleItemIcons(
    item,
    spots,
    excursions,
    travelItems,
    maps,
    linkedExcursion
  );

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
    icon: icons.icon,
    iconDef: icons.iconDef,
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
  if (!trip || !trip.start_date) return [];
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
  if (trip.end_date && trip.end_date !== trip.start_date) {
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
  spots: Spot[]
): CalendarEntry[] {
  // Erstelle Maps für O(1) Lookups bei der Iteration über alle Kalender-Termine
  const spotMap = new Map<number, Spot>();
  for (const s of spots) spotMap.set(s.id, s);
  const excursionMap = new Map<number, Excursion>();
  for (const e of excursions) excursionMap.set(e.id, e);
  const travelMap = new Map<number, TravelItem>();
  for (const t of travelItems) travelMap.set(t.id, t);
  const maps: CalendarLookupMaps = { spotMap, excursionMap, travelMap };

  return [
    ...items.map((item) => scheduleItemToEntry(item, spots, excursions, travelItems, maps)),
    ...buildTripEntries(trip),
    ...buildTodoEntries(todos),
  ];
}
