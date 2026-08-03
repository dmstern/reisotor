import { describe, expect, it } from 'vitest';
import type { TravelItem, TravelPlace } from '../api/types';
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

function travelPlace(overrides: Partial<TravelPlace>): TravelPlace {
  return {
    id: 1,
    trip_id: 1,
    name: 'Ort',
    is_home: 0,
    type: null,
    maps_link: null,
    lat: null,
    lng: null,
    ...overrides,
  };
}

describe('buildTravelDerivedLocations', () => {
  it('zeigt jeden angelegten Ort genau einmal - unabhängig davon, von wie vielen Etappen aus er referenziert wird', () => {
    const home = travelPlace({ id: 10, name: 'Zuhause', is_home: 1, lat: 48.1, lng: 11.5 });
    const destination = travelPlace({ id: 20, name: 'Zielflughafen', is_home: 0, lat: 40.8, lng: 14.2 });
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

    const result = buildTravelDerivedLocations([hinflug, rueckflug], [home, destination]);

    // 4 Etappen-Enden (Hinflug Von/Nach, Rückflug Von/Nach), aber nur 2 angelegte Orte -> genau 2
    // Ergebnis-Einträge statt 4, mit dem vom Nutzer vergebenen Ortsnamen als Titel (nicht
    // "Hinflug (Abflug/Abfahrt)"/"Rückflug (Ankunft)").
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.title).sort()).toEqual(['Zielflughafen', 'Zuhause']);
    expect(result.map((r) => r.key).sort()).toEqual(['travel-place-10', 'travel-place-20']);
  });

  it('homeSide kommt von place.is_home, unabhängig von der Ort-Art (type)', () => {
    // Realistischer Fall aus dem Bugreport: der heimische Abflughafen ist is_home=true, obwohl sein
    // type "Flughafen" ist, nicht "Zuhause" - type allein dürfte das nicht verwechseln.
    const homeAirport = travelPlace({ id: 1, name: 'Flughafen BER', is_home: 1, type: 'Flughafen', lat: 52.4, lng: 13.5 });
    const destinationAirport = travelPlace({ id: 2, name: 'Flughafen NAP', is_home: 0, type: 'Flughafen', lat: 40.8, lng: 14.2 });

    const result = buildTravelDerivedLocations([], [homeAirport, destinationAirport]);

    expect(result.find((r) => r.key === 'travel-place-1')?.homeSide).toBe(true);
    expect(result.find((r) => r.key === 'travel-place-2')?.homeSide).toBe(false);
  });

  it('verwendet das Icon der gewählten Ort-Art statt eines festen Flugzeug-Icons', () => {
    const station = travelPlace({ id: 1, name: 'Hauptbahnhof', type: 'Bahnhof', lat: 48.1, lng: 11.5 });

    const result = buildTravelDerivedLocations([], [station]);

    expect(result[0].icon).toBe('🚆');
  });

  it('fällt für einen unbekannten/fehlenden Typ auf den generischen Pin zurück', () => {
    const place = travelPlace({ id: 1, name: 'Irgendwo', type: null, lat: 48.1, lng: 11.5 });

    const result = buildTravelDerivedLocations([], [place]);

    expect(result[0].icon).toBe('📍');
  });

  it('ignoriert Orte ohne Koordinaten', () => {
    const place = travelPlace({ id: 1, name: 'Ohne Standort', lat: null, lng: null });

    const result = buildTravelDerivedLocations([], [place]);

    expect(result).toHaveLength(0);
  });

  it('zeigt Etappen-Enden ohne verknüpften Ort (Freitext-Eingabe) weiterhin über das Transportmittel-Icon der Etappe', () => {
    const zugfahrt = travelItem({
      id: 1,
      title: 'Zugfahrt',
      type: 'Zug',
      from_lat: 48.1,
      from_lng: 11.5,
      to_lat: 52.5,
      to_lng: 13.4,
    });

    const result = buildTravelDerivedLocations([zugfahrt], []);

    expect(result).toHaveLength(2);
    const from = result.find((r) => r.key === 'travel-from-1');
    const to = result.find((r) => r.key === 'travel-to-1');
    expect(from?.title).toBe('Zugfahrt (Abflug/Abfahrt)');
    expect(from?.icon).toBe('🚆');
    expect(to?.title).toBe('Zugfahrt (Ankunft)');
  });

  it('dedupliziert freie Etappen-Enden ohne verknüpften Ort über gerundete Koordinaten', () => {
    const a = travelItem({ id: 1, title: 'A', from_lat: 48.123456, from_lng: 11.654321 });
    const b = travelItem({ id: 2, title: 'B', from_lat: 48.123457, from_lng: 11.654322 });

    const result = buildTravelDerivedLocations([a, b], []);

    expect(result).toHaveLength(1);
  });

  it('mischt verknüpfte Orte und freie Etappen-Enden ohne Überschneidung', () => {
    const home = travelPlace({ id: 10, name: 'Zuhause', is_home: 1, lat: 48.1, lng: 11.5 });
    const linked = travelItem({
      id: 1,
      title: 'Hinflug',
      from_place_id: 10,
      from_lat: 48.1,
      from_lng: 11.5,
      to_lat: null,
      to_lng: null,
    });
    const freeform = travelItem({
      id: 2,
      title: 'Taxi zum Hotel',
      type: 'Auto',
      from_lat: null,
      from_lng: null,
      to_lat: 40.8,
      to_lng: 14.2,
    });

    const result = buildTravelDerivedLocations([linked, freeform], [home]);

    expect(result).toHaveLength(2);
    expect(result.some((r) => r.key === 'travel-place-10' && r.title === 'Zuhause')).toBe(true);
    expect(result.some((r) => r.key === 'travel-to-2' && r.icon === '🚗')).toBe(true);
  });
});
