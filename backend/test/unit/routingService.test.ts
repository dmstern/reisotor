import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db/index.js';
import {
  getDirections,
  mapTransportToProfile,
  roundCoord,
} from '../../src/services/routingService.js';

describe('routingService unit tests', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM routing_cache').run();
    process.env.ORS_API_KEY = 'test-ors-api-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ORS_API_KEY;
  });

  describe('mapTransportToProfile & roundCoord', () => {
    it('mappt bekannte Verkehrsmittel korrekt auf Profile', () => {
      expect(mapTransportToProfile('Auto')).toBe('driving-car');
      expect(mapTransportToProfile('Fahrrad')).toBe('cycling-regular');
      expect(mapTransportToProfile('zu Fuß')).toBe('foot-walking');
      expect(mapTransportToProfile('zu fuss')).toBe('foot-walking');
      expect(mapTransportToProfile('driving-car')).toBe('driving-car');
      expect(mapTransportToProfile('Zug')).toBeNull();
      expect(mapTransportToProfile('Flug')).toBeNull();
    });

    it('akzeptiert explizit gültige Profile', () => {
      expect(mapTransportToProfile(undefined, 'cycling-mountain')).toBe('cycling-mountain');
      expect(mapTransportToProfile(undefined, 'invalid-profile')).toBeNull();
    });

    it('rundet Koordinaten konsistent auf 5 Nachkommastellen', () => {
      expect(roundCoord(52.520008)).toBe(52.52001);
      expect(roundCoord(13.404954)).toBe(13.40495);
    });
  });

  describe('getDirections', () => {
    it('gibt supported: false zurück bei nicht unterstütztem Verkehrsmittel', async () => {
      const res = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Zug',
      });
      expect(res.supported).toBe(false);
      expect(res.routes).toHaveLength(0);
      expect(res.reason).toContain('wird nicht für exaktes Straßen-/Wege-Routing unterstützt');
    });

    it('gibt supported: false zurück wenn ORS_API_KEY fehlt', async () => {
      delete process.env.ORS_API_KEY;
      const res = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Auto',
      });
      expect(res.supported).toBe(false);
      expect(res.reason).toContain('ORS_API_KEY fehlt');
    });

    it('fragt OpenRouteService an und speichert Ergebnis im SQLite-Cache', async () => {
      const mockOrsGeoJson = {
        features: [
          {
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.405, 52.525],
                [13.41, 52.53],
              ],
            },
            properties: {
              summary: {
                distance: 1540.5,
                duration: 185.2,
              },
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrsGeoJson,
      } as unknown as Response);

      const res = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Auto',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res.supported).toBe(true);
      expect(res.routes).toHaveLength(1);
      expect(res.routes[0]).toEqual({
        coordinates: [
          [52.52, 13.4],
          [52.525, 13.405],
          [52.53, 13.41],
        ],
        distance_meters: 1541,
        duration_seconds: 185,
        profile: 'driving-car',
      });

      // Zweiter Aufruf muss aus dem SQLite-Cache bedient werden (ohne neuen fetch)
      const cachedRes = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Auto',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1); // Unverändert 1!
      expect(cachedRes.supported).toBe(true);
      expect(cachedRes.routes[0].distance_meters).toBe(1541);
    });
  });
});
