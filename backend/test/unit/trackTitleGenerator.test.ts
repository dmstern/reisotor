import { describe, expect, it, vi } from 'vitest';
import {
  haversineMeters,
  calculateTrackMetrics,
  inferMovementType,
  extractPlaceLabel,
  formatPrepositionAndPlace,
  formatTimeBasedTrackTitle,
  generateSmartTrackTitle,
  type ExtractedPlace,
} from '../../src/utils/trackTitleGenerator.js';
import type { ReverseGeocodeResult } from '../../src/utils/places.js';

describe('trackTitleGenerator (backend)', () => {
  describe('haversineMeters', () => {
    it('berechnet die Distanz zwischen zwei bekannten Koordinaten korrekt', () => {
      // Berlin Alexanderplatz zu Brandenburger Tor ca. 2.4 km
      const alex = { lat: 52.5219, lng: 13.4132 };
      const gate = { lat: 52.5163, lng: 13.3777 };
      const dist = haversineMeters(alex, gate);
      expect(dist).toBeGreaterThan(2300);
      expect(dist).toBeLessThan(2600);
    });

    it('gibt 0 zurück bei identischen Koordinaten', () => {
      const pt = { lat: 52.5, lng: 13.4 };
      expect(haversineMeters(pt, pt)).toBe(0);
    });
  });

  describe('inferMovementType', () => {
    it('erkennt stationäre Tracks bei geringer Distanz oder Dauer', () => {
      expect(inferMovementType(0, 10, 10_000)).toBe('stationary');
      expect(inferMovementType(null, 100, 100_000)).toBe('stationary');
      expect(inferMovementType(4, 20, 20_000)).toBe('stationary');
    });

    it('erkennt Spaziergänge bei Schritttempo (< 7.5 km/h)', () => {
      expect(inferMovementType(4.5, 2000, 25 * 60 * 1000)).toBe('walk');
    });

    it('erkennt Wanderungen bei längerer Strecke oder vielen Höhenmetern', () => {
      expect(inferMovementType(4.0, 6000, 90 * 60 * 1000, 50)).toBe('hike');
      expect(inferMovementType(3.5, 2500, 45 * 60 * 1000, 200)).toBe('hike');
    });

    it('erkennt Radtouren bei mittlerer Geschwindigkeit (7.5 - 28 km/h)', () => {
      expect(inferMovementType(16, 5000, 20 * 60 * 1000)).toBe('bike');
      expect(inferMovementType(8.5, 3000, 20 * 60 * 1000)).toBe('bike');
      expect(inferMovementType(24, 15000, 35 * 60 * 1000)).toBe('bike');
    });

    it('erkennt Fahrten bei hoher Geschwindigkeit (>= 28 km/h)', () => {
      expect(inferMovementType(45, 20000, 30 * 60 * 1000)).toBe('drive');
      expect(inferMovementType(100, 80000, 48 * 60 * 1000)).toBe('drive');
    });
  });

  describe('extractPlaceLabel', () => {
    it('bevorzugt Parks, Natur und Ausflugsziele', () => {
      const geo: ReverseGeocodeResult = {
        name: 'Plänterwald',
        formatted_address: 'Plänterwald, Berlin',
        address: 'Plänterwald',
        lat: 52.48,
        lng: 13.48,
        osmKey: 'leisure',
        osmValue: 'park',
        district: 'Treptow',
        city: 'Berlin',
      };
      const place = extractPlaceLabel(geo);
      expect(place).toEqual({ label: 'Plänterwald', kind: 'nature' });
    });

    it('bevorzugt Sehenswürdigkeiten wie Torre de Belém', () => {
      const geo: ReverseGeocodeResult = {
        name: 'Torre de Belém',
        formatted_address: 'Torre de Belém, Lisboa',
        address: 'Torre de Belém',
        lat: 38.69,
        lng: -9.21,
        osmKey: 'historic',
        osmValue: 'monument',
        district: 'Belém',
        city: 'Lisboa',
      };
      const place = extractPlaceLabel(geo);
      expect(place).toEqual({ label: 'Torre de Belém', kind: 'poi' });
    });

    it('ignoriert Restaurants und Gewerbenamen und nimmt stattdessen den Stadtteil', () => {
      const geo: ReverseGeocodeResult = {
        name: 'Pizzeria Bella Italia',
        formatted_address: 'Bergmannstraße 10, 10961 Berlin',
        address: 'Bergmannstraße 10',
        lat: 52.49,
        lng: 13.39,
        osmKey: 'amenity',
        osmValue: 'restaurant',
        district: 'Kreuzberg',
        city: 'Berlin',
      };
      const place = extractPlaceLabel(geo);
      expect(place).toEqual({ label: 'Kreuzberg', kind: 'district' });
    });

    it('verwendet locality / Gemeinde, wenn kein Stadtteil vorhanden ist', () => {
      const geo: ReverseGeocodeResult = {
        name: 'Hauptstraße 5',
        formatted_address: 'Hauptstraße 5, 14959 Trebbin',
        address: 'Hauptstraße 5',
        lat: 52.21,
        lng: 13.22,
        osmKey: 'highway',
        osmValue: 'residential',
        locality: 'Trebbin',
        city: 'Trebbin',
      };
      const place = extractPlaceLabel(geo);
      expect(place).toEqual({ label: 'Trebbin', kind: 'city' });
    });
  });

  describe('formatPrepositionAndPlace', () => {
    it('erzeugt "durch den" für Wälder, Parks und Gärten', () => {
      expect(formatPrepositionAndPlace({ label: 'Plänterwald', kind: 'nature' })).toBe(
        'durch den Plänterwald'
      );
      expect(formatPrepositionAndPlace({ label: 'Tiergarten', kind: 'nature' })).toBe(
        'durch den Tiergarten'
      );
      expect(formatPrepositionAndPlace({ label: 'Englischer Garten', kind: 'nature' })).toBe(
        'durch den Englischer Garten'
      );
    });

    it('erzeugt "um den" für Seen', () => {
      expect(formatPrepositionAndPlace({ label: 'Wannsee', kind: 'nature' })).toBe(
        'um den Wannsee'
      );
    });

    it('erzeugt "bei" für Sehenswürdigkeiten', () => {
      expect(formatPrepositionAndPlace({ label: 'Torre de Belém', kind: 'poi' })).toBe(
        'bei Torre de Belém'
      );
    });

    it('erzeugt "in" für Stadtteile und Städte', () => {
      expect(formatPrepositionAndPlace({ label: 'Kreuzberg', kind: 'district' })).toBe(
        'in Kreuzberg'
      );
      expect(formatPrepositionAndPlace({ label: 'Berlin', kind: 'city' })).toBe('in Berlin');
    });
  });

  describe('formatTimeBasedTrackTitle', () => {
    it('erzeugt "Sonntagsspaziergang" für sonntägliche Spaziergänge', () => {
      // 2026-10-18 war ein Sonntag
      const sundayMorning = new Date('2026-10-18T09:30:00');
      expect(formatTimeBasedTrackTitle(sundayMorning, 'walk')).toBe('Sonntagsspaziergang');
    });

    it('erzeugt wochentagsbezogene Titel am Morgen für generische Touren', () => {
      // 2026-10-19 war ein Montag
      const mondayMorning = new Date('2026-10-19T08:15:00');
      expect(formatTimeBasedTrackTitle(mondayMorning, 'generic')).toBe(
        'Morgendliche Tour am Montag'
      );
    });

    it('erzeugt "Feierabend-Radtour" an Wochentagen abends', () => {
      // 2026-10-21 war ein Mittwoch
      const wednesdayEvening = new Date('2026-10-21T18:45:00');
      expect(formatTimeBasedTrackTitle(wednesdayEvening, 'bike')).toBe(
        'Feierabend-Radtour am Mittwoch'
      );
    });

    it('erzeugt "Sonntagsfahrt" bei schneller Fortbewegung am Sonntag', () => {
      const sundayNoon = new Date('2026-10-18T12:00:00');
      expect(formatTimeBasedTrackTitle(sundayNoon, 'drive')).toBe('Sonntagsfahrt');
    });
  });

  describe('generateSmartTrackTitle', () => {
    it('erzeugt "Spaziergang von Trebbin nach Kreuzberg"', async () => {
      const startGeo: ReverseGeocodeResult = {
        name: 'Bahnhof Trebbin',
        formatted_address: 'Trebbin',
        address: 'Trebbin',
        lat: 52.21,
        lng: 13.22,
        locality: 'Trebbin',
        city: 'Trebbin',
      };
      const endGeo: ReverseGeocodeResult = {
        name: 'Kottbusser Tor',
        formatted_address: 'Berlin',
        address: 'Berlin',
        lat: 52.49,
        lng: 13.41,
        district: 'Kreuzberg',
        city: 'Berlin',
      };

      const points = [
        { lat: 52.21, lng: 13.22, recorded_at: '2026-10-20T08:00:00Z' },
        { lat: 52.35, lng: 13.31, recorded_at: '2026-10-20T12:00:00Z' },
        { lat: 52.49, lng: 13.41, recorded_at: '2026-10-20T16:00:00Z' },
      ];

      const title = await generateSmartTrackTitle({
        startedAt: '2026-10-20T08:00:00Z',
        endedAt: '2026-10-20T16:00:00Z',
        points,
        reverseGeocodeFn: async ({ lat }) => (lat < 52.3 ? startGeo : endGeo),
      });

      expect(title).toBe('Wanderung von Trebbin nach Kreuzberg');
    });

    it('erzeugt "Spaziergang von Trebbin nach Kreuzberg" bei kürzerer Strecke', async () => {
      const startGeo: ReverseGeocodeResult = {
        name: 'Bahnhof Trebbin',
        formatted_address: 'Trebbin',
        address: 'Trebbin',
        lat: 52.21,
        lng: 13.22,
        locality: 'Trebbin',
        city: 'Trebbin',
      };
      const endGeo: ReverseGeocodeResult = {
        name: 'Kottbusser Tor',
        formatted_address: 'Berlin',
        address: 'Berlin',
        lat: 52.22,
        lng: 13.24,
        district: 'Kreuzberg',
        city: 'Berlin',
      };

      // 2 km in 30 Minuten (ca. 4 km/h, Spaziergang)
      const points = [
        { lat: 52.21, lng: 13.22, recorded_at: '2026-10-20T10:00:00Z' },
        { lat: 52.22, lng: 13.24, recorded_at: '2026-10-20T10:30:00Z' },
      ];

      const title = await generateSmartTrackTitle({
        startedAt: '2026-10-20T10:00:00Z',
        endedAt: '2026-10-20T10:30:00Z',
        points,
        reverseGeocodeFn: async ({ lat }) => (lat < 52.215 ? startGeo : endGeo),
      });

      expect(title).toBe('Spaziergang von Trebbin nach Kreuzberg');
    });

    it('erzeugt "Fahrt von Berlin nach Hamburg" bei hoher Geschwindigkeit', async () => {
      const berlinGeo: ReverseGeocodeResult = {
        name: 'Berlin Hbf',
        formatted_address: 'Berlin',
        address: 'Berlin',
        lat: 52.52,
        lng: 13.37,
        city: 'Berlin',
      };
      const hamburgGeo: ReverseGeocodeResult = {
        name: 'Hamburg Hbf',
        formatted_address: 'Hamburg',
        address: 'Hamburg',
        lat: 53.55,
        lng: 10.0,
        city: 'Hamburg',
      };

      const points = [
        { lat: 52.52, lng: 13.37, recorded_at: '2026-10-20T10:00:00Z' },
        { lat: 53.55, lng: 10.0, recorded_at: '2026-10-20T12:00:00Z' },
      ];

      const title = await generateSmartTrackTitle({
        startedAt: '2026-10-20T10:00:00Z',
        endedAt: '2026-10-20T12:00:00Z',
        points,
        reverseGeocodeFn: async ({ lat }) => (lat < 53.0 ? berlinGeo : hamburgGeo),
      });

      expect(title).toBe('Fahrt von Berlin nach Hamburg');
    });

    it('erzeugt "Radtour durch den Plänterwald" für Radtouren in Parks/Wäldern', async () => {
      const plaenterwaldGeo: ReverseGeocodeResult = {
        name: 'Plänterwald',
        formatted_address: 'Plänterwald, Berlin',
        address: 'Plänterwald',
        lat: 52.48,
        lng: 13.48,
        osmKey: 'leisure',
        osmValue: 'park',
        district: 'Treptow',
        city: 'Berlin',
      };

      // Loop im Plänterwald (Tempo ca. 16 km/h)
      const points = [
        { lat: 52.485, lng: 13.481, recorded_at: '2026-10-20T14:00:00Z' },
        { lat: 52.489, lng: 13.489, recorded_at: '2026-10-20T14:05:00Z' },
        { lat: 52.484, lng: 13.482, recorded_at: '2026-10-20T14:10:00Z' },
      ];

      const title = await generateSmartTrackTitle({
        startedAt: '2026-10-20T14:00:00Z',
        endedAt: '2026-10-20T14:10:00Z',
        points,
        reverseGeocodeFn: async () => plaenterwaldGeo,
      });

      expect(title).toBe('Radtour durch den Plänterwald');
    });

    it('fällt bei Fehlschlag der Geokodierung sauber auf den Zeit-Fallback zurück', async () => {
      // 2026-10-18T07:00:00Z (09:00 Uhr MESZ) war ein Sonntag Vormittag
      const points = [
        { lat: 52.0, lng: 13.0, recorded_at: '2026-10-18T07:00:00Z' },
        { lat: 52.005, lng: 13.005, recorded_at: '2026-10-18T07:15:00Z' },
      ];

      const title = await generateSmartTrackTitle({
        startedAt: '2026-10-18T07:00:00Z',
        endedAt: '2026-10-18T07:15:00Z',
        points,
        reverseGeocodeFn: async () => null,
      });

      expect(title).toBe('Sonntagsspaziergang');
    });
  });
});
