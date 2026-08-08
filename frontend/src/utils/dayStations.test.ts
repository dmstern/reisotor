import { describe, expect, it } from 'vitest';
import type { Spot, TravelItem } from '../api/types';
import { buildDayStations } from './dayStations';

function travelItem(overrides: Partial<TravelItem>): TravelItem {
  return {
    id: 1,
    trip_id: 1,
    title: 'Reise',
    type: null,
    from_location: null,
    to_location: null,
    date: null,
    departure_time: null,
    arrival_time: null,
    checkin_info: null,
    amount: null,
    paid_by_user_id: null,
    luggage: null,
    seat: null,
    link: null,
    note: null,
    note_format: 'legacy',
    budget_expense_id: null,
    from_maps_link: null,
    from_lat: null,
    from_lng: null,
    to_maps_link: null,
    to_lat: null,
    to_lng: null,
    role: null,
    from_place_id: null,
    to_place_id: null,
    ...overrides,
  };
}

function spot(overrides: Partial<Spot>): Spot {
  return {
    id: 1,
    trip_id: 1,
    title: 'Ort',
    image_url: null,
    category: null,
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
    ...overrides,
  };
}

// Regressionsnetz für den Tages-Fokus-Stationen-Bau (Tag auf Karte anzeigen): Reise-Etappen desselben
// Tages werden über ihren tatsächlichen ORT verkettet statt über die Etappe selbst - bei "A -> B"
// gefolgt von "B -> C" soll B nur EINMAL als Station auftauchen, die Verbindungslinie dazwischen
// trägt stattdessen den Namen der jeweiligen Etappe (ExcursionStation.connector). Reise-Orte sind
// seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz normale Spots.
describe('buildDayStations - Reise-Etappen-Verkettung', () => {
  const placeA = spot({ id: 1, title: 'Zuhause', lat: 48.1, lng: 11.5 });
  const placeB = spot({ id: 2, title: 'Zwischenstopp', lat: 45.0, lng: 12.0 });
  const placeC = spot({ id: 3, title: 'Zielort', lat: 40.8, lng: 14.2 });

  it('zeigt den geteilten Zwischenort (B) nur einmal statt als zwei benachbarte, identische Stationen', () => {
    const legAB = travelItem({
      id: 1,
      title: 'Hinflug',
      date: '2026-08-10',
      departure_time: '08:00',
      arrival_time: '10:00',
      from_place_id: placeA.id,
      to_place_id: placeB.id,
    });
    const legBC = travelItem({
      id: 2,
      title: 'Weiterreise',
      date: '2026-08-10',
      departure_time: '12:00',
      arrival_time: '14:00',
      from_place_id: placeB.id,
      to_place_id: placeC.id,
    });

    const stations = buildDayStations('2026-08-10', [], [], [legAB, legBC], [placeA, placeB, placeC]);

    expect(stations.map((s) => s.title)).toEqual(['Zuhause', 'Zwischenstopp', 'Zielort']);
  });

  it('beschriftet die Verbindung zur jeweiligen Ziel-Station mit dem Namen der Etappe', () => {
    const legAB = travelItem({
      id: 1,
      title: 'Hinflug',
      date: '2026-08-10',
      departure_time: '08:00',
      from_place_id: placeA.id,
      to_place_id: placeB.id,
    });
    const legBC = travelItem({
      id: 2,
      title: 'Weiterreise',
      date: '2026-08-10',
      departure_time: '12:00',
      from_place_id: placeB.id,
      to_place_id: placeC.id,
    });

    const stations = buildDayStations('2026-08-10', [], [], [legAB, legBC], [placeA, placeB, placeC]);

    expect(stations[0].connector).toBeFalsy();
    expect(stations[1].connector?.label).toBe('Hinflug');
    expect(stations[2].connector?.label).toBe('Weiterreise');
  });

  it('verkettet unabhängig von der Reihenfolge im Eingabe-Array (sortiert intern nach Abflugzeit)', () => {
    const legAB = travelItem({
      id: 1,
      title: 'Hinflug',
      date: '2026-08-10',
      departure_time: '08:00',
      from_place_id: placeA.id,
      to_place_id: placeB.id,
    });
    const legBC = travelItem({
      id: 2,
      title: 'Weiterreise',
      date: '2026-08-10',
      departure_time: '12:00',
      from_place_id: placeB.id,
      to_place_id: placeC.id,
    });

    // Rückreihenfolge im Eingabe-Array - ohne interne Sortierung nach Abflugzeit würde die
    // Duplikat-Erkennung hier fälschlich nicht greifen.
    const stations = buildDayStations('2026-08-10', [], [], [legBC, legAB], [placeA, placeB, placeC]);

    expect(stations.map((s) => s.title)).toEqual(['Zuhause', 'Zwischenstopp', 'Zielort']);
  });

  it('zeigt nicht-verknüpfte (Freitext-) Etappen weiterhin mit Reise-Titel + Transportmittel-Icon', () => {
    const leg = travelItem({
      id: 1,
      title: 'Taxi zum Flughafen',
      type: 'Auto',
      date: '2026-08-10',
      departure_time: '06:00',
      from_lat: 48.1,
      from_lng: 11.5,
      to_lat: 48.35,
      to_lng: 11.78,
    });

    const stations = buildDayStations('2026-08-10', [], [], [leg], []);

    expect(stations.map((s) => s.title)).toEqual([
      'Taxi zum Flughafen (Abflug/Abfahrt)',
      'Taxi zum Flughafen (Ankunft)',
    ]);
    expect(stations[1].icon).toBe('🚗');
  });

  it('ignoriert Etappen an anderen Tagen', () => {
    const otherDay = travelItem({
      id: 1,
      title: 'Hinflug',
      date: '2026-08-11',
      from_place_id: placeA.id,
      to_place_id: placeB.id,
    });

    const stations = buildDayStations('2026-08-10', [], [], [otherDay], [placeA, placeB]);

    expect(stations).toHaveLength(0);
  });
});
