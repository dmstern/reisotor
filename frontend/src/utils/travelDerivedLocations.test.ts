import { describe, expect, it } from 'vitest';
import type { TravelItem } from '../api/types';
import { buildTravelDerivedLocations } from './travelDerivedLocations';

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

describe('buildTravelDerivedLocations', () => {
  it('dedupliziert Hin- und Rückflug, die dieselben Orte (per place_id) teilen', () => {
    const hinflug = travelItem({
      id: 1,
      title: 'Hinflug',
      type: 'Flug',
      role: 'arrival',
      from_place_id: 10, // Zuhause
      from_lat: 48.1,
      from_lng: 11.5,
      to_place_id: 20, // Zielflughafen
      to_lat: 40.8,
      to_lng: 14.2,
    });
    const rueckflug = travelItem({
      id: 2,
      title: 'Rückflug',
      type: 'Flug',
      role: 'departure',
      from_place_id: 20, // Zielflughafen (derselbe Ort wie hinflug.to_place_id)
      from_lat: 40.8,
      from_lng: 14.2,
      to_place_id: 10, // Zuhause (derselbe Ort wie hinflug.from_place_id)
      to_lat: 48.1,
      to_lng: 11.5,
    });

    const result = buildTravelDerivedLocations([hinflug, rueckflug]);

    // 4 Etappen-Enden, aber nur 2 zugrunde liegende Orte -> genau 2 Ergebnis-Einträge statt 4.
    expect(result).toHaveLength(2);
  });

  it('markiert einen Ort als homeSide, sobald irgendeine seiner Etappen-Seiten das nahelegt', () => {
    const hinflug = travelItem({
      id: 1,
      title: 'Hinflug',
      role: 'arrival',
      from_place_id: 10,
      from_lat: 48.1,
      from_lng: 11.5,
      to_place_id: 20,
      to_lat: 40.8,
      to_lng: 14.2,
    });
    const rueckflug = travelItem({
      id: 2,
      title: 'Rückflug',
      role: 'departure',
      from_place_id: 20,
      from_lat: 40.8,
      from_lng: 14.2,
      to_place_id: 10,
      to_lat: 48.1,
      to_lng: 11.5,
    });

    const result = buildTravelDerivedLocations([hinflug, rueckflug]);
    const home = result.find((r) => r.key === 'travel-from-1');
    const destination = result.find((r) => r.key === 'travel-to-1');

    expect(home?.homeSide).toBe(true);
    expect(destination?.homeSide).toBe(false);
  });

  it('verwendet das Transportmittel-Icon des Reise-Eintrags statt eines festen Flugzeug-Icons', () => {
    const zugfahrt = travelItem({
      id: 1,
      title: 'Zugfahrt',
      type: 'Zug',
      from_lat: 48.1,
      from_lng: 11.5,
      to_lat: 52.5,
      to_lng: 13.4,
    });

    const result = buildTravelDerivedLocations([zugfahrt]);

    expect(result.find((r) => r.key === 'travel-from-1')?.icon).toBe('🚆');
    expect(result.find((r) => r.key === 'travel-to-1')?.icon).toBe('🚆');
  });

  it('fällt für einen unbekannten/fehlenden Typ auf den generischen Pin zurück (nicht das Reise-Ticket-Icon)', () => {
    const sonstiges = travelItem({
      id: 1,
      title: 'Sonstiges',
      type: null,
      from_lat: 48.1,
      from_lng: 11.5,
    });

    const result = buildTravelDerivedLocations([sonstiges]);

    expect(result.find((r) => r.key === 'travel-from-1')?.icon).toBe('📍');
  });

  it('dedupliziert auch ohne place_id anhand gerundeter Koordinaten', () => {
    const a = travelItem({ id: 1, title: 'A', from_lat: 48.123456, from_lng: 11.654321 });
    const b = travelItem({ id: 2, title: 'B', from_lat: 48.123457, from_lng: 11.654322 });

    const result = buildTravelDerivedLocations([a, b]);

    expect(result).toHaveLength(1);
  });

  it('behält unterschiedliche, nicht verknüpfte Orte als getrennte Einträge', () => {
    const a = travelItem({ id: 1, title: 'A', from_lat: 48.1, from_lng: 11.5 });
    const b = travelItem({ id: 2, title: 'B', from_lat: 52.5, from_lng: 13.4 });

    const result = buildTravelDerivedLocations([a, b]);

    expect(result).toHaveLength(2);
  });

  it('ignoriert Etappen-Seiten ohne Koordinaten', () => {
    const item = travelItem({ id: 1, title: 'Nur Hinweg', from_lat: 48.1, from_lng: 11.5 });

    const result = buildTravelDerivedLocations([item]);

    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('travel-from-1');
  });
});
