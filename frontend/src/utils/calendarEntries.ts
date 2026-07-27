import type { Accommodation, CalendarEntry, Excursion, ScheduleItem, Spot, TodoItem, TravelItem, Trip } from '../api/types';
import { resolveStations } from './excursionStations';

export function scheduleItemToEntry(item: ScheduleItem): CalendarEntry {
  return {
    key: `s-${item.id}`,
    kind: 'schedule',
    date: item.date,
    endDate: item.end_date ?? item.date,
    time: item.time,
    title: item.title,
    note: item.note,
    location: item.location,
    category: item.category,
    ideaId: null,
    todoId: null,
    travelId: null,
    scheduleItem: item,
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
      title: `Urlaub-Start: ${trip.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      todoId: null,
      travelId: null,
      scheduleItem: null,
    },
  ];
  if (trip.end_date !== trip.start_date) {
    entries.push({
      key: 'trip-end',
      kind: 'trip',
      date: trip.end_date,
      endDate: trip.end_date,
      time: null,
      title: `Urlaub-Ende: ${trip.name}`,
      note: null,
      location: null,
      category: 'trip',
      ideaId: null,
      todoId: null,
      travelId: null,
      scheduleItem: null,
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
      title: t.title,
      note: t.note,
      location: null,
      category: 'todo' as const,
      ideaId: null,
      todoId: t.id,
      travelId: null,
      scheduleItem: null,
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
      title: t.title,
      note: t.note,
      location: t.from_location && t.to_location ? `${t.from_location} → ${t.to_location}` : null,
      category: 'travel' as const,
      ideaId: null,
      todoId: null,
      travelId: t.id,
      scheduleItem: null,
    }));
}

// Ausflüge mit gesetztem Datum erscheinen automatisch (nicht editierbar) im Kalender – das Datum
// selbst ist die einzige Kalender-Verknüpfung (kein separater schedule_items-Eintrag mehr nötig,
// im Unterschied zum alten Drag&Drop-Einplanen-Mechanismus). Hat ein Ausflug genau eine Station,
// zeigt sein Kalender-Eintrag deren Kategorie-Icon statt des generischen 🎒 (z. B. bei spontan
// per Kalender-Anfasser/Tagebuch eingeplanten Einzel-Spots, siehe SpotCard.vue/DiaryView.vue).
export function buildExcursionEntries(
  excursions: Excursion[],
  spots: Spot[],
  accommodations: Accommodation[],
  travelItems: TravelItem[],
): CalendarEntry[] {
  return excursions
    .filter((e): e is Excursion & { date: string } => !!e.date)
    .map((e) => {
      const stations = resolveStations(e.station_keys, spots, accommodations, travelItems);
      return {
        key: `excursion-${e.id}`,
        kind: 'excursion' as const,
        date: e.date,
        endDate: e.date,
        time: null,
        title: e.title,
        note: e.note,
        location: null,
        category: 'excursion' as const,
        icon: stations.length === 1 ? stations[0].icon : undefined,
        ideaId: e.id,
        todoId: null,
        travelId: null,
        scheduleItem: null,
      };
    });
}

export function buildAllEntries(
  items: ScheduleItem[],
  trip: Trip | null,
  todos: TodoItem[],
  travelItems: TravelItem[],
  excursions: Excursion[],
  spots: Spot[],
  accommodations: Accommodation[],
): CalendarEntry[] {
  return [
    ...items.map(scheduleItemToEntry),
    ...buildTripEntries(trip),
    ...buildTodoEntries(todos),
    ...buildTravelEntries(travelItems),
    ...buildExcursionEntries(excursions, spots, accommodations, travelItems),
  ];
}
