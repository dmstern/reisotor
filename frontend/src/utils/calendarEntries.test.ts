import { describe, expect, it } from 'vitest';
import {
  buildAllEntries,
  buildDiaryEntries,
  buildSpotEntries,
  buildTodoEntries,
  buildTourEntries,
  buildTripEntries,
  scheduleItemToEntry,
} from './calendarEntries';
import type { DiaryEntry, Excursion, ScheduleItem, Spot, TodoItem, Trip } from '../api/types';

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
  weather_model: 'ecmwf_ifs025',
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

  it('übernimmt bei einem mit einem Spot verknüpften manuellen Termin dessen Kategorie-Icon und spotId', () => {
    const spot: Spot = {
      id: 42,
      trip_id: 1,
      title: 'Torre de Belém',
      image_url: null,
      category: 'Sehenswürdigkeit',
      note: null,
      note_format: 'legacy',
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
      done: 0,
    };
    const item = makeScheduleItem({ spot_id: 42 });
    const entry = scheduleItemToEntry(item, [spot], [], []);
    expect(entry.category).toBe('other');
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
      note_format: 'legacy',
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
      done: 0,
    };
    const excursion: Excursion = {
      id: 3,
      trip_id: 1,
      title: 'Sightseeing',
      image_url: null,
      note: null,
      note_format: 'legacy',
      date: '2026-08-02',
      created_by: null,
      spot_ids: [7],
      done: 0,
      role: null,
      transport_type: null,
      departure_time: null,
      arrival_time: null,
      checkin_info: null,
      amount: null,
      paid_by_user_id: null,
      luggage: null,
      seat: null,
      ticket_link: null,
      budget_expense_id: null,
    };
    const item = makeScheduleItem({ idea_id: 3, title: 'Sightseeing' });
    const entry = scheduleItemToEntry(item, [spot], [excursion], []);
    expect(entry.category).toBe('excursion');
    expect(entry.icon).toBe('🍽️');
    expect(entry.ideaId).toBe(3);
  });

  it('übernimmt bei einer verknüpften Tour mit gesetzter role (#176: ehemalige Reise-Etappe) die eigene "Reise"-Kategorie statt "Ausflug"', () => {
    const excursion: Excursion = {
      id: 4,
      trip_id: 1,
      title: 'Hinflug',
      image_url: null,
      note: null,
      note_format: 'legacy',
      date: '2026-08-01',
      created_by: null,
      spot_ids: [1, 2],
      done: 0,
      role: 'arrival',
      transport_type: 'Flug',
      departure_time: '07:20',
      arrival_time: '10:05',
      checkin_info: null,
      amount: null,
      paid_by_user_id: null,
      luggage: null,
      seat: null,
      ticket_link: null,
      budget_expense_id: null,
    };
    const item = makeScheduleItem({ idea_id: 4, date: '2026-08-01', title: 'Hinflug' });
    const entry = scheduleItemToEntry(item, [], [excursion], []);
    expect(entry.category).toBe('travel');
    expect(entry.ideaId).toBe(4);
  });
});

describe('buildTripEntries', () => {
  it('returns [] for a null trip', () => {
    expect(buildTripEntries(null)).toEqual([]);
  });

  it('builds start and end entries for a trip with different start/end dates', () => {
    const entries = buildTripEntries(trip);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      kind: 'trip',
      date: '2026-08-01',
      title: 'Urlaub-Start: Sommerurlaub',
    });
    expect(entries[1]).toMatchObject({
      kind: 'trip',
      date: '2026-08-10',
      title: 'Urlaub-Ende: Sommerurlaub',
    });
  });

  it('collapses to a single entry when start and end date are the same', () => {
    const dayTrip: Trip = { ...trip, end_date: trip.start_date };
    expect(buildTripEntries(dayTrip)).toHaveLength(1);
  });
});

describe('buildTodoEntries', () => {
  it('excludes todos without a due date', () => {
    const todos: TodoItem[] = [
      {
        id: 1,
        trip_id: 1,
        title: 'Ohne Datum',
        assigned_to_user_id: null,
        due_date: null,
        priority: 'medium',
        note: null,
        done: 0,
      },
      {
        id: 2,
        trip_id: 1,
        title: 'Mit Datum',
        assigned_to_user_id: null,
        due_date: '2026-08-03',
        priority: 'medium',
        note: null,
        done: 0,
      },
    ];
    const entries = buildTodoEntries(todos);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'todo',
      date: '2026-08-03',
      title: 'Mit Datum',
      todoId: 2,
    });
  });
});

describe('buildTourEntries', () => {
  it('projiziert Touren und Reisen mit Datum direkt in den Kalender und ignoriert ungeplante', () => {
    const tour: Excursion = {
      id: 10,
      trip_id: 1,
      title: 'Altstadt-Walk',
      image_url: null,
      note: 'Bequeme Schuhe',
      note_format: 'legacy',
      date: '2026-08-03',
      created_by: null,
      spot_ids: [],
      done: 1,
      role: null,
      transport_type: null,
      departure_time: '09:30',
      arrival_time: '12:00',
      checkin_info: null,
      amount: null,
      paid_by_user_id: null,
      luggage: null,
      seat: null,
      ticket_link: null,
      budget_expense_id: null,
    };
    const travel: Excursion = {
      ...tour,
      id: 11,
      title: 'Hinflug',
      date: '2026-08-01',
      done: 0,
      role: 'arrival',
      transport_type: 'Flug',
      departure_time: '07:00',
      arrival_time: '10:00',
    };
    const unplanned: Excursion = {
      ...tour,
      id: 12,
      title: 'Idee ohne Datum',
      date: null,
    };

    const entries = buildTourEntries([tour, travel, unplanned], []);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      key: 'excursion-10',
      kind: 'excursion',
      date: '2026-08-03',
      ideaId: 10,
      done: true,
      category: 'excursion',
    });
    expect(entries[1]).toMatchObject({
      key: 'travel-11',
      kind: 'travel',
      date: '2026-08-01',
      ideaId: 11,
      done: false,
      category: 'travel',
    });
  });
});

describe('buildSpotEntries', () => {
  it('projiziert Spot-Besuchsdaten aus spot.dates direkt in den Kalender und überspringt Unterkünfte', () => {
    const spot: Spot = {
      id: 42,
      trip_id: 1,
      title: 'Torre de Belém',
      image_url: null,
      category: 'Sehenswürdigkeit',
      note: null,
      note_format: 'legacy',
      maps_link: null,
      lat: null,
      lng: null,
      created_by: null,
      is_home: 0,
      address: 'Av. Brasília',
      start_date: null,
      end_date: null,
      checkin: null,
      checkout: null,
      contact: null,
      amount: null,
      paid_by_user_id: null,
      budget_expense_id: null,
      done: 0,
      dates: [
        { id: 1, trip_id: 1, spot_id: 42, date: '2026-08-02', done: 0, created_at: '' },
        { id: 2, trip_id: 1, spot_id: 42, date: '2026-08-05', done: 1, created_at: '' },
      ],
    };
    const hotel: Spot = {
      ...spot,
      id: 43,
      title: 'Hotel Altstadt',
      category: 'Unterkunft',
      dates: [{ id: 3, trip_id: 1, spot_id: 43, date: '2026-08-01', done: 0, created_at: '' }],
    };

    const entries = buildSpotEntries([spot, hotel]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      key: 'spot-date-1',
      kind: 'spot',
      date: '2026-08-02',
      spotId: 42,
      spotDateId: 1,
      done: false,
    });
    expect(entries[1]).toMatchObject({
      key: 'spot-date-2',
      kind: 'spot',
      date: '2026-08-05',
      spotId: 42,
      spotDateId: 2,
      done: true,
    });
  });
});

describe('buildDiaryEntries', () => {
  it('projiziert veröffentlichte Tagebucheinträge in den Kalender und ignoriert Entwürfe', () => {
    const published: DiaryEntry = {
      id: 7,
      trip_id: 1,
      author_id: 1,
      date: '2026-08-04',
      title: 'Ankunft am Meer',
      content: 'Super Wetter',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 0,
      created_at: '2026-08-04T18:00:00Z',
      updated_at: null,
    };
    const draft: DiaryEntry = {
      ...published,
      id: 8,
      title: 'Entwurf',
      is_draft: 1,
    };

    const entries = buildDiaryEntries([published, draft]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      key: 'diary-7',
      kind: 'diary',
      date: '2026-08-04',
      title: 'Ankunft am Meer',
      diaryEntryId: 7,
      category: 'diary',
    });
  });
});

describe('buildAllEntries', () => {
  it('combines schedule items, trip, todos, tours, spots and diary entries into one array', () => {
    const scheduleItem = makeScheduleItem({
      id: 1,
      date: '2026-08-01',
      time: null,
      title: 'Termin',
      note: null,
      location: null,
    });
    const spot: Spot = {
      id: 50,
      trip_id: 1,
      title: 'Museum',
      category: 'Kultur',
      done: 0,
      dates: [{ id: 10, trip_id: 1, spot_id: 50, date: '2026-08-03', done: 0, created_at: '' }],
    } as Spot;
    const diary: DiaryEntry = {
      id: 9,
      trip_id: 1,
      author_id: 1,
      date: '2026-08-04',
      title: 'Tag 4',
      content: '',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 0,
      created_at: '',
      updated_at: null,
    };

    const entries = buildAllEntries([scheduleItem], trip, [], [], [], [spot], [diary]);
    // 1 schedule + 2 trip + 1 spot + 1 diary = 5
    expect(entries).toHaveLength(5);
    expect(entries.some((e) => e.kind === 'schedule')).toBe(true);
    expect(entries.filter((e) => e.kind === 'trip')).toHaveLength(2);
    expect(entries.some((e) => e.kind === 'spot')).toBe(true);
    expect(entries.some((e) => e.kind === 'diary')).toBe(true);
  });
});
