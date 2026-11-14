import { describe, expect, it } from 'vitest';
import type { Spot } from '../api/types';
import {
  chooseRoutingProfile,
  formatSpotDistance,
  getValidAccommodations,
  haversineMeters,
  resolveReferenceAccommodation,
  shouldShowAccommodationDistance,
  WALKING_THRESHOLD_METERS,
} from './spotAccommodationDistance';

describe('spotAccommodationDistance utils', () => {
  const dummySpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Aussichtspunkt',
    category: 'Aussicht',
    lat: 48.137,
    lng: 11.575,
  } as Spot;

  const hotelA: Spot = {
    id: 10,
    trip_id: 1,
    title: 'Hotel München',
    category: 'Unterkunft',
    lat: 48.14,
    lng: 11.58,
    start_date: '2026-07-01',
    end_date: '2026-07-05',
  } as Spot;

  const hotelB: Spot = {
    id: 11,
    trip_id: 1,
    title: 'Hotel Salzburg',
    category: 'Unterkunft',
    lat: 47.8,
    lng: 13.04,
    start_date: '2026-07-05',
    end_date: '2026-07-10',
  } as Spot;

  describe('shouldShowAccommodationDistance', () => {
    it('gibt true für reguläre Spots mit Koordinaten zurück', () => {
      expect(shouldShowAccommodationDistance(dummySpot)).toBe(true);
    });

    it('gibt false für Spots ohne Koordinaten zurück', () => {
      expect(shouldShowAccommodationDistance({ ...dummySpot, lat: null })).toBe(false);
      expect(shouldShowAccommodationDistance({ ...dummySpot, lng: null })).toBe(false);
    });

    it('gibt false für Unterkünfte selbst zurück', () => {
      expect(shouldShowAccommodationDistance(hotelA)).toBe(false);
    });

    it('gibt false für Heimat-Orte zurück', () => {
      expect(shouldShowAccommodationDistance({ ...dummySpot, is_home: 1 })).toBe(false);
    });
  });

  describe('getValidAccommodations', () => {
    it('filtert nur Unterkünfte mit gültigen Koordinaten', () => {
      const hotelWithoutCoords: Spot = { ...hotelA, id: 99, lat: null, lng: null };
      const res = getValidAccommodations([dummySpot, hotelA, hotelWithoutCoords, hotelB]);
      expect(res).toEqual([hotelA, hotelB]);
    });
  });

  describe('resolveReferenceAccommodation', () => {
    it('wählt die zeitlich passende Unterkunft bei passendem scheduledDate', () => {
      const res = resolveReferenceAccommodation(dummySpot, [hotelA, hotelB], '2026-07-03');
      expect(res?.id).toBe(hotelA.id);

      const res2 = resolveReferenceAccommodation(dummySpot, [hotelA, hotelB], '2026-07-07');
      expect(res2?.id).toBe(hotelB.id);
    });

    it('wählt die räumlich nächste Unterkunft, wenn kein Datum passt oder keines übergeben wurde', () => {
      // dummySpot ist in München (~48.137, 11.575), näher an hotelA
      const res = resolveReferenceAccommodation(dummySpot, [hotelA, hotelB], null);
      expect(res?.id).toBe(hotelA.id);

      // Spot in Salzburg
      const salzburgSpot: Spot = { ...dummySpot, lat: 47.81, lng: 13.05 };
      const resSalzburg = resolveReferenceAccommodation(salzburgSpot, [hotelA, hotelB], null);
      expect(resSalzburg?.id).toBe(hotelB.id);
    });

    it('gibt null zurück, wenn keine gültigen Unterkünfte vorhanden sind', () => {
      expect(resolveReferenceAccommodation(dummySpot, [], '2026-07-03')).toBeNull();
    });
  });

  describe('chooseRoutingProfile', () => {
    it('wählt foot-walking bis 2000 Meter', () => {
      expect(chooseRoutingProfile(500)).toBe('foot-walking');
      expect(chooseRoutingProfile(WALKING_THRESHOLD_METERS)).toBe('foot-walking');
    });

    it('wählt driving-car über 2000 Meter', () => {
      expect(chooseRoutingProfile(2001)).toBe('driving-car');
      expect(chooseRoutingProfile(15000)).toBe('driving-car');
    });
  });

  describe('formatSpotDistance', () => {
    it('formatiert Meter und Kilometer mit deutscher Notation', () => {
      expect(formatSpotDistance(450)).toBe('450\u00A0m');
      expect(formatSpotDistance(1200)).toBe('1,2\u00A0km');
      expect(formatSpotDistance(14200)).toBe('14,2\u00A0km');
    });

    it('fügt bei isFallback das Ungefähr-Zeichen hinzu', () => {
      expect(formatSpotDistance(450, true)).toBe('≈\u00A0450\u00A0m');
      expect(formatSpotDistance(2400, true)).toBe('≈\u00A02,4\u00A0km');
    });
  });

  describe('haversineMeters', () => {
    it('berechnet plausible Distanzen', () => {
      const dist = haversineMeters({ lat: 48.137, lng: 11.575 }, { lat: 48.14, lng: 11.58 });
      expect(dist).toBeGreaterThan(400);
      expect(dist).toBeLessThan(600);
    });
  });
});
