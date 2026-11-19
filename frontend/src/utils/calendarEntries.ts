import type {
  CalendarEntry,
  DiaryEntry,
  Excursion,
  ScheduleItem,
  Spot,
  TodoItem,
  TravelItem,
  Trip,
} from '../api/types';
import { excursionStationKeys, resolveStations } from './excursionStations';
import { spotCategoryMeta } from './spotCategory';
import { travelTypeIconDef } from './travelTypeIcon';
import { SECTION_ICON_DEFS } from './sectionIcons';
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
  ...rest: [travelItems?: TravelItem[], maps?: CalendarLookupMaps, preloadedExcursion?: Excursion]
): { icon: string | undefined; iconDef: IconDef | undefined } {
  const [travelItems = [], maps, preloadedExcursion] = rest;

  if (item.spot_id != null) {
    const spot = maps?.spotMap
      ? maps.spotMap.get(item.spot_id)
      : spots.find((targetSpot) => targetSpot.id === item.spot_id);

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

export function resolveScheduleItemIcon(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[]
): string | undefined {
  return resolveScheduleItemIcons(item, spots, excursions, travelItems).icon;
}

export function resolveScheduleItemIconDef(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  travelItems: TravelItem[]
): IconDef | undefined {
  return resolveScheduleItemIcons(item, spots, excursions, travelItems).iconDef;
}

export interface ScheduleItemToEntryOptions {
  spots: Spot[];
  excursions: Excursion[];
  travelItems?: TravelItem[];
  maps?: CalendarLookupMaps;
}

export function scheduleItemToEntry(
  item: ScheduleItem,
  options: ScheduleItemToEntryOptions
): CalendarEntry;

export function scheduleItemToEntry(
  item: ScheduleItem,
  spots: Spot[],
  excursions: Excursion[],
  ...rest: [travelItems?: TravelItem[], maps?: CalendarLookupMaps]
): CalendarEntry;

export function scheduleItemToEntry(
  item: ScheduleItem,
  spotsOrOptions: Spot[] | ScheduleItemToEntryOptions,
  excursionsArg?: Excursion[],
  ...rest: [travelItems?: TravelItem[], maps?: CalendarLookupMaps]
): CalendarEntry {
  let spots: Spot[];
  let excursions: Excursion[];
  let travelItems: TravelItem[];
  let maps: CalendarLookupMaps | undefined;

  if (!Array.isArray(spotsOrOptions)) {
    spots = spotsOrOptions.spots;
    excursions = spotsOrOptions.excursions;
    travelItems = spotsOrOptions.travelItems ?? [];
    maps = spotsOrOptions.maps;
  } else {
    spots = spotsOrOptions;
    excursions = excursionsArg ?? [];
    travelItems = rest[0] ?? [];
    maps = rest[1];
  }

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

  let resolvedCategory = item.category || 'other';

  if (linkedExcursion?.role) {
    resolvedCategory = 'travel';
  } else if (item.idea_id != null) {
    resolvedCategory = 'excursion';
  }

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
    category: resolvedCategory,
    icon: icons.icon,
    iconDef: icons.iconDef,
    ideaId: item.idea_id,
    spotId: item.spot_id,
    todoId: null,
    scheduleItem: item,
    done: Boolean(item.done),
  };
}

function tourToCalendarEntry(
  excursion: Excursion,
  spots: Spot[],
  travelItems: TravelItem[],
  maps?: CalendarLookupMaps
): CalendarEntry | null {
  if (!excursion.date) {
    return null;
  }

  if (excursion.role) {
    const transportIcon = excursion.transport_type
      ? travelTypeIconDef(excursion.transport_type)
      : undefined;
    return {
      key: `travel-${excursion.id}`,
      kind: 'travel',
      date: excursion.date,
      endDate: excursion.date,
      time: excursion.departure_time ?? null,
      endTime: excursion.arrival_time ?? null,
      title: excursion.title,
      note: excursion.note,
      location: null,
      category: 'travel',
      icon: transportIcon?.emoji,
      iconDef: transportIcon,
      ideaId: excursion.id,
      spotId: null,
      todoId: null,
      scheduleItem: null,
      done: Boolean(excursion.done),
    };
  }

  const stations = resolveStations(
    excursionStationKeys(excursion.spot_ids),
    spots,
    travelItems,
    maps?.spotMap,
    maps?.travelMap
  );
  const singleStationIcon = stations.length === 1 ? stations[0] : undefined;

  return {
    key: `excursion-${excursion.id}`,
    kind: 'excursion',
    date: excursion.date,
    endDate: excursion.date,
    time: excursion.departure_time ?? null,
    endTime: excursion.arrival_time ?? null,
    title: excursion.title,
    note: excursion.note,
    location: null,
    category: 'excursion',
    icon: singleStationIcon?.icon,
    iconDef: singleStationIcon?.tabler,
    ideaId: excursion.id,
    spotId: null,
    todoId: null,
    scheduleItem: null,
    done: Boolean(excursion.done),
  };
}

/** Direkte Kalender-Projektion für alle Touren mit gesetztem Datum (#800). */
export function buildTourEntries(
  excursions: Excursion[],
  spots: Spot[],
  travelItems: TravelItem[] = [],
  maps?: CalendarLookupMaps
): CalendarEntry[] {
  const entries: CalendarEntry[] = [];

  for (const excursion of excursions) {
    const entry = tourToCalendarEntry(excursion, spots, travelItems, maps);

    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}

/** Direkte Kalender-Projektion für Spots mit Besuchstagen (spot_dates, #800). */
export function buildSpotEntries(spots: Spot[]): CalendarEntry[] {
  const entries: CalendarEntry[] = [];

  for (const spot of spots) {
    if (spot.category === 'Unterkunft' || !spot.dates?.length) {
      continue;
    }

    const meta = spotCategoryMeta(spot.category);

    for (const dateEntry of spot.dates) {
      if (!dateEntry.date) {
        continue;
      }

      entries.push({
        key: `spot-date-${dateEntry.id}`,
        kind: 'spot',
        date: dateEntry.date,
        endDate: dateEntry.date,
        time: null,
        endTime: null,
        title: spot.title,
        note: spot.note,
        location: spot.address,
        category: 'spot',
        icon: meta.icon,
        iconDef: meta.tabler,
        ideaId: null,
        spotId: spot.id,
        spotDateId: dateEntry.id,
        todoId: null,
        scheduleItem: null,
        done: Boolean(dateEntry.done),
      });
    }
  }

  return entries;
}

/** Direkte Kalender-Projektion für veröffentlichte Tagebucheinträge (#800.3). */
export function buildDiaryEntries(diaryEntries: DiaryEntry[]): CalendarEntry[] {
  return diaryEntries
    .filter((entry) => !entry.is_draft && Boolean(entry.date))
    .map((entry) => ({
      key: `diary-${entry.id}`,
      kind: 'diary' as const,
      date: entry.date,
      endDate: entry.date,
      time: null,
      endTime: null,
      title: entry.title?.trim() || 'Tagebucheintrag',
      note: null,
      location: null,
      category: 'diary' as const,
      icon: SECTION_ICON_DEFS.diary.emoji,
      iconDef: SECTION_ICON_DEFS.diary,
      ideaId: null,
      spotId: null,
      todoId: null,
      diaryEntryId: entry.id,
      scheduleItem: null,
      done: false,
    }));
}

// Urlaub-Stammdaten erscheinen automatisch als (nicht editierbare) Kalender-Items der Kategorie
// "Urlaub" – synthetisch aus den Trip-Stammdaten erzeugt, nicht in schedule_items gespeichert (Batch 3).
export function buildTripEntries(trip: Trip | null): CalendarEntry[] {
  if (!trip || !trip.start_date) {
    return [];
  }

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

// Aufgaben mit Fälligkeitsdatum erscheinen automatisch im Kalender (Batch 9).
export function buildTodoEntries(todos: TodoItem[]): CalendarEntry[] {
  return todos
    .filter((todo): todo is TodoItem & { due_date: string } => Boolean(todo.due_date))
    .map((todo) => ({
      key: `todo-${todo.id}`,
      kind: 'todo' as const,
      date: todo.due_date,
      endDate: todo.due_date,
      time: null,
      endTime: null,
      title: todo.title,
      note: todo.note,
      location: null,
      category: 'todo' as const,
      ideaId: null,
      spotId: null,
      todoId: todo.id,
      scheduleItem: null,
      done: Boolean(todo.done),
    }));
}

export interface BuildAllEntriesOptions {
  items: ScheduleItem[];
  trip: Trip | null;
  todos: TodoItem[];
  travelItems: TravelItem[];
  excursions: Excursion[];
  spots: Spot[];
  diaryEntries?: DiaryEntry[];
}

export function buildAllEntries(options: BuildAllEntriesOptions): CalendarEntry[];

export function buildAllEntries(
  items: ScheduleItem[],
  trip: Trip | null,
  todos: TodoItem[],
  ...rest: [
    travelItems: TravelItem[],
    excursions: Excursion[],
    spots: Spot[],
    diaryEntries?: DiaryEntry[],
  ]
): CalendarEntry[];

export function buildAllEntries(
  itemsOrOptions: ScheduleItem[] | BuildAllEntriesOptions,
  tripArg?: Trip | null,
  todosArg?: TodoItem[],
  ...rest: [
    travelItems?: TravelItem[],
    excursions?: Excursion[],
    spots?: Spot[],
    diaryEntries?: DiaryEntry[],
  ]
): CalendarEntry[] {
  let items: ScheduleItem[];
  let trip: Trip | null;
  let todos: TodoItem[];
  let travelItems: TravelItem[];
  let excursions: Excursion[];
  let spots: Spot[];
  let diaryEntries: DiaryEntry[];

  if (!Array.isArray(itemsOrOptions)) {
    items = itemsOrOptions.items;
    trip = itemsOrOptions.trip;
    todos = itemsOrOptions.todos;
    travelItems = itemsOrOptions.travelItems;
    excursions = itemsOrOptions.excursions;
    spots = itemsOrOptions.spots;
    diaryEntries = itemsOrOptions.diaryEntries ?? [];
  } else {
    items = itemsOrOptions;
    trip = tripArg ?? null;
    todos = todosArg ?? [];
    travelItems = rest[0] ?? [];
    excursions = rest[1] ?? [];
    spots = rest[2] ?? [];
    diaryEntries = rest[3] ?? [];
  }

  const spotMap = new Map<number, Spot>();

  for (const spot of spots) {
    spotMap.set(spot.id, spot);
  }

  const excursionMap = new Map<number, Excursion>();

  for (const excursion of excursions) {
    excursionMap.set(excursion.id, excursion);
  }

  const travelMap = new Map<number, TravelItem>();

  for (const travelItem of travelItems) {
    travelMap.set(travelItem.id, travelItem);
  }

  const maps: CalendarLookupMaps = { spotMap, excursionMap, travelMap };

  return [
    ...items.map((item) => scheduleItemToEntry(item, spots, excursions, travelItems, maps)),
    ...buildTourEntries(excursions, spots, travelItems, maps),
    ...buildSpotEntries(spots),
    ...buildDiaryEntries(diaryEntries),
    ...buildTripEntries(trip),
    ...buildTodoEntries(todos),
  ];
}
