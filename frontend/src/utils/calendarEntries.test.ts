import { describe, expect, it } from 'vitest';
import { buildAllEntries, buildTodoEntries, buildTravelEntries, buildTripEntries, scheduleItemToEntry } from './calendarEntries';
import type { Excursion, ScheduleItem, Spot, TodoItem, TravelItem, Trip } from '../api/types';

const trip: Trip = {
  id: 1,
  name: 'Sommerurlaub',
  destination: 'Lissabon',
  start_date: '2026-08-01',
  end_date: '2026-08-10',
  maps_link: null,
  lat: null,
  lng: null,
  image_url: null,
  packing_category_required: 1,
};

function makeScheduleItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 5,
    trip_id: 1,
    date: '2026-08-02',
    end_date: null,
    time: '10:00',
    end_time: null,
    title: 'Museum',
    note: 'Tickets vorher kaufen',
    location: 'Museu Nacional',
    maps_link: null,
    lat: null,
    lng: null,
    category: 'other',
    spot_id: null,
    idea_id: null,
    ...overrides,
  };
}

describe('scheduleItemToEntry', () => {
  it('maps a freeform (unverknüpften) ScheduleItem to the expected CalendarEntry fields', () => {
    const item = makeScheduleItem();
    expect(scheduleItemToEntry(item, [], [], [])).toMatchObject({
      key: 's-5',
      kind: 'schedule',
      date: '2026-08-02',
      title: 'Museum',
      location: 'Museu Nacional',
      category: 'other',
      icon: undefined,
      scheduleItem: item,
    });
  });

  it('übernimmt bei einem mit einem Spot verknüpften Termin dessen Kategorie-Icon und die Ausflug-Farbe', () => {
    const spot: Spot = {
      id: 42,
      trip_id: 1,
      title: 'Torre de Belém',
      image_url: null,
      category: 'Sehenswürdigkeit',
      note: null,
      maps_link: null,
      lat: null,
      lng: null,
      created_by: null,
      is_home: 0,
      address: null,
      start_date: null,
      end_date: null,
      checkin: null,
      checkout: null,
      contact: null,
      amount: null,
      paid_by_user_id: null,
      budget_expense_id: null,
    };
    const item = makeScheduleItem({ spot_id: 42 });
    const entry = scheduleItemToEntry(item, [spot], [], []);
    expect(entry.category).toBe('excursion');
    expect(entry.icon).toBe('🏰');
    expect(entry.spotId).toBe(42);
  });

  it('übernimmt bei einer verknüpften Tour mit genau einer Spot-Station deren Icon', () => {
    const spot: Spot = {
      id: 7,
      trip_id: 1,
      title: 'Time Out Market',
      image_url: null,
      category: 'Restaurant',
      note: null,
      maps_link: null,
      lat: null,
      lng: null,
      created_by: null,
      is_home: 0,
      address: null,
      start_date: null,
      end_date: null,
      checkin: null,
      checkout: null,
      contact: null,
      amount: null,
      paid_by_user_id: null,
      budget_expense_id: null,
    };
    const excursion: Excursion = {
      id: 3,
      trip_id: 1,
      title: 'Sightseeing',
      image_url: null,
      note: null,
      date: '2026-08-02',
      created_by: null,
      spot_ids: [7],
    };
    const item = makeScheduleItem({ idea_id: 3, title: 'Sightseeing' });
    const entry = scheduleItemToEntry(item, [spot], [excursion], []);
    expect(entry.category).toBe('excursion');
    expect(entry.icon).toBe('🍽️');
    expect(entry.ideaId).toBe(3);
  });
});

describe('buildTripEntries', () => {
  it('returns [] for a null trip', () => {
    expect(buildTripEntries(null)).toEqual([]);
  });

  it('builds start and end entries for a trip with different start/end dates', () => {
    const entries = buildTripEntries(trip);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ kind: 'trip', date: '2026-08-01', title: 'Urlaub-Start: Sommerurlaub' });
    expect(entries[1]).toMatchObject({ kind: 'trip', date: '2026-08-10', title: 'Urlaub-Ende: Sommerurlaub' });
  });

  it('collapses to a single entry when start and end date are the same', () => {
    const dayTrip: Trip = { ...trip, end_date: trip.start_date };
    expect(buildTripEntries(dayTrip)).toHaveLength(1);
  });
});

describe('buildTodoEntries', () => {
  it('excludes todos without a due date', () => {
    const todos: TodoItem[] = [
      { id: 1, trip_id: 1, title: 'Ohne Datum', assigned_to_user_id: null, due_date: null, priority: 'medium', note: null, done: 0 },
      { id: 2, trip_id: 1, title: 'Mit Datum', assigned_to_user_id: null, due_date: '2026-08-03', priority: 'medium', note: null, done: 0 },
    ];
    const entries = buildTodoEntries(todos);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'todo', date: '2026-08-03', title: 'Mit Datum', todoId: 2 });
  });
});

describe('buildTravelEntries', () => {
  it('maps a dated travel item, joining from/to as location', () => {
    const items: TravelItem[] = [
      {
        id: 9,
        trip_id: 1,
        title: 'Hinflug',
        type: 'flight',
        from_location: 'Berlin',
        to_location: 'Lissabon',
        date: '2026-08-01',
        departure_time: '07:20',
        arrival_time: '10:05',
        checkin_info: null,
        amount: null,
        paid_by_user_id: null,
        luggage: null,
        seat: null,
        link: null,
        note: null,
        budget_expense_id: null,
        from_maps_link: null,
        from_lat: null,
        from_lng: null,
      } as TravelItem,
    ];
    const entries = buildTravelEntries(items);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'travel',
      date: '2026-08-01',
      time: '07:20',
      location: 'Berlin → Lissabon',
      travelId: 9,
    });
  });
});

describe('buildAllEntries', () => {
  it('combines schedule items, trip, todos and travel into one array', () => {
    const scheduleItem = makeScheduleItem({ id: 1, date: '2026-08-01', time: null, title: 'Termin', note: null, location: null });
    const entries = buildAllEntries([scheduleItem], trip, [], [], [], [] as Spot[]);
    // 1 schedule + 2 trip (Start/Ende) = 3
    expect(entries).toHaveLength(3);
    expect(entries.some((e) => e.kind === 'schedule')).toBe(true);
    expect(entries.filter((e) => e.kind === 'trip')).toHaveLength(2);
  });
});
