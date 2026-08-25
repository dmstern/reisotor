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

// Seit der Verschmelzung von Reise-Orten in Spots (siehe Migrationskommentar in db/index.ts) decken
// verknüpfte Etappen-Enden (from_place_id/to_place_id gesetzt) keinen eigenen Ableitungspfad mehr ab
// - sie sind ganz normale Spots und erscheinen bereits über die bestehende Spots-Liste. Diese Suite
// deckt nur noch den verbleibenden Fallback ab: Etappen-Enden ohne verknüpften Ort (Freitext-Von/Nach).
describe('buildTravelDerivedLocations', () => {
  it('zeigt Etappen-Enden ohne verknüpften Ort (Freitext-Eingabe) über das Transportmittel-Icon der Etappe', () => {
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

    expect(result).toHaveLength(2);
    const from = result.find((r) => r.key === 'travel-from-1');
    const to = result.find((r) => r.key === 'travel-to-1');
    expect(from?.title).toBe('Zugfahrt (Abflug/Abfahrt)');
    expect(from?.icon).toBe('🚆');
    expect(to?.title).toBe('Zugfahrt (Ankunft)');
  });

  it('ignoriert Etappen-Enden mit verknüpftem Ort (from_place_id/to_place_id) - die sind bereits normale Spots', () => {
    const linked = travelItem({
      id: 1,
      title: 'Hinflug',
      from_place_id: 10,
      from_lat: 48.1,
      from_lng: 11.5,
      to_place_id: 20,
      to_lat: 40.8,
      to_lng: 14.2,
    });

    const result = buildTravelDerivedLocations([linked]);

    expect(result).toHaveLength(0);
  });

  it('dedupliziert freie Etappen-Enden ohne verknüpften Ort über gerundete Koordinaten', () => {
    const a = travelItem({ id: 1, title: 'A', from_lat: 48.123456, from_lng: 11.654321 });
    const b = travelItem({ id: 2, title: 'B', from_lat: 48.123457, from_lng: 11.654322 });

    const result = buildTravelDerivedLocations([a, b]);

    expect(result).toHaveLength(1);
  });

  it('mischt verknüpfte Orte (übersprungen) und freie Etappen-Enden ohne Überschneidung', () => {
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

    const result = buildTravelDerivedLocations([linked, freeform]);

    expect(result).toHaveLength(1);
    expect(result.some((r) => r.key === 'travel-to-2' && r.icon === '🚗')).toBe(true);
  });

  it('ignoriert Etappen-Enden ohne Koordinaten', () => {
    const leg = travelItem({
      id: 1,
      title: 'Ohne Standort',
      from_lat: null,
      from_lng: null,
      to_lat: null,
      to_lng: null,
    });

    const result = buildTravelDerivedLocations([leg]);

    expect(result).toHaveLength(0);
  });
});
