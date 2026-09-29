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

    it('liefert bis zu 3 alternative Routen und unterstützt preference (shortest/fastest)', async () => {
      const mockThreeRoutes = {
        features: [
          {
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.41, 52.53],
              ],
            },
            properties: { summary: { distance: 1500, duration: 180 } },
          },
          {
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.408, 52.528],
                [13.41, 52.53],
              ],
            },
            properties: { summary: { distance: 1620, duration: 170 } },
          },
          {
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.395, 52.525],
                [13.41, 52.53],
              ],
            },
            properties: { summary: { distance: 1750, duration: 195 } },
          },
          {
            // 4. Route soll auf maximal 3 begrenzt werden
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.41, 52.53],
              ],
            },
            properties: { summary: { distance: 2000, duration: 300 } },
          },
        ],
      };

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockThreeRoutes,
      } as unknown as Response);

      const res = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Auto',
        preference: 'shortest',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const requestCall = fetchSpy.mock.calls[0];
      const sentBody = JSON.parse(requestCall[1]?.body as string);
      expect(sentBody.preference).toBe('shortest');
      expect(sentBody.alternative_routes).toEqual({
        target_count: 3,
        weight_factor: 1.6,
        share_factor: 0.8,
      });

      expect(res.supported).toBe(true);
      expect(res.routes).toHaveLength(3); // Auf 3 begrenzt!
      expect(res.routes[0].distance_meters).toBe(1500);
      expect(res.routes[1].distance_meters).toBe(1620);
      expect(res.routes[2].distance_meters).toBe(1750);
    });

    it('führt Fallback-Retry ohne alternative_routes durch falls ORS Fehler meldet', async () => {
      const mockSingleRoute = {
        features: [
          {
            geometry: {
              coordinates: [
                [13.4, 52.52],
                [13.41, 52.53],
              ],
            },
            properties: { summary: { distance: 1500, duration: 180 } },
          },
        ],
      };

      // Erster Aufruf mit alternative_routes schlägt fehl (z.B. HTTP 400 Parameter-Limit)
      const fetchSpy = vi
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Parameter alternative_routes exceeds server limits',
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSingleRoute,
        } as unknown as Response);

      const res = await getDirections({
        from: { lat: 52.52, lng: 13.4 },
        to: { lat: 52.53, lng: 13.41 },
        transportType: 'Fahrrad',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      // Erster Aufruf hatte alternative_routes
      const firstBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
      expect(firstBody.alternative_routes).toBeDefined();

      // Zweiter Aufruf hatte keine alternative_routes
      const secondBody = JSON.parse(fetchSpy.mock.calls[1][1]?.body as string);
      expect(secondBody.alternative_routes).toBeUndefined();

      expect(res.supported).toBe(true);
      expect(res.routes).toHaveLength(1);
    });
  });
});
