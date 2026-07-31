import { describe, expect, it } from 'vitest';
import {
  buildAllEntries,
  buildExcursionEntries,
  buildTodoEntries,
  buildTravelEntries,
  buildTripEntries,
  scheduleItemToEntry,
} from './calendarEntries';
import type { Accommodation, Excursion, ScheduleItem, Spot, TodoItem, TravelItem, Trip } from '../api/types';

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
};

describe('scheduleItemToEntry', () => {
  it('maps a ScheduleItem to the expected CalendarEntry fields', () => {
    const item: ScheduleItem = {
      id: 5,
      trip_id: 1,
      date: '2026-08-02',
      end_date: null,
      time: '10:00',
      title: 'Museum',
      note: 'Tickets vorher kaufen',
      location: 'Museu Nacional',
      maps_link: null,
      lat: null,
      lng: null,
      category: 'other',
    };
    expect(scheduleItemToEntry(item)).toMatchObject({
      key: 's-5',
      kind: 'schedule',
      date: '2026-08-02',
      title: 'Museum',
      location: 'Museu Nacional',
      category: 'other',
      scheduleItem: item,
    });
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

describe('buildExcursionEntries', () => {
  it('maps a dated excursion', () => {
    const excursions: Excursion[] = [
      { id: 3, trip_id: 1, title: 'Sightseeing', image_url: null, note: null, date: '2026-08-02', created_by: null, station_keys: [] },
    ];
    const entries = buildExcursionEntries(excursions, [] as Spot[], [] as Accommodation[], [] as TravelItem[]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'excursion', date: '2026-08-02', title: 'Sightseeing', ideaId: 3 });
  });

  it('excludes excursions without a date', () => {
    const excursions: Excursion[] = [
      { id: 4, trip_id: 1, title: 'In Planung', image_url: null, note: null, date: null, created_by: null, station_keys: [] },
    ];
    expect(buildExcursionEntries(excursions, [], [], [])).toEqual([]);
  });
});

describe('buildAllEntries', () => {
  it('combines schedule items, trip, todos, travel and excursions into one array', () => {
    const scheduleItem: ScheduleItem = {
      id: 1,
      trip_id: 1,
      date: '2026-08-01',
      end_date: null,
      time: null,
      title: 'Termin',
      note: null,
      location: null,
      maps_link: null,
      lat: null,
      lng: null,
      category: 'other',
    };
    const entries = buildAllEntries([scheduleItem], trip, [], [], [], [], []);
    // 1 schedule + 2 trip (Start/Ende) = 3
    expect(entries).toHaveLength(3);
    expect(entries.some((e) => e.kind === 'schedule')).toBe(true);
    expect(entries.filter((e) => e.kind === 'trip')).toHaveLength(2);
  });
});
