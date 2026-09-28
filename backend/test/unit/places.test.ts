import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _clearPlacesCache,
  buildCacheKey,
  clearPlacesCache,
  derivePlaceName,
  formatAddress,
  getCachedPlaces,
  getPlacesCacheSize,
  mapOsmToCategory,
  searchPlaces,
  setCachedPlaces,
  reverseGeocode,
  clearReverseCache,
} from '../../src/utils/places.js';

describe('places utility (unit)', () => {
  beforeEach(() => {
    clearPlacesCache();
    clearReverseCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearPlacesCache();
    clearReverseCache();
  });

  describe('mapOsmToCategory', () => {
    it('maps tourism tags correctly', () => {
      expect(mapOsmToCategory('tourism', 'hotel')).toBe('Unterkunft');
      expect(mapOsmToCategory('tourism', 'hostel')).toBe('Unterkunft');
      expect(mapOsmToCategory('tourism', 'camp_site')).toBe('Campingplatz');
      expect(mapOsmToCategory('tourism', 'museum')).toBe('Museum');
      expect(mapOsmToCategory('tourism', 'viewpoint')).toBe('Aussichtspunkt');
      expect(mapOsmToCategory('tourism', 'zoo')).toBe('Zoo & Tierpark');
      expect(mapOsmToCategory('tourism', 'attraction')).toBe('Sehenswürdigkeit');
      expect(mapOsmToCategory('tourism', 'something_else')).toBe('Ausflugsziel');
    });

    it('maps amenity tags correctly', () => {
      expect(mapOsmToCategory('amenity', 'restaurant')).toBe('Restaurant');
      expect(mapOsmToCategory('amenity', 'cafe')).toBe('Café');
      expect(mapOsmToCategory('amenity', 'bar')).toBe('Nachtleben');
      expect(mapOsmToCategory('amenity', 'pharmacy')).toBe('Apotheke');
      expect(mapOsmToCategory('amenity', 'fuel')).toBe('Tankstelle');
      expect(mapOsmToCategory('amenity', 'bank')).toBe('Geldautomat & Bank');
      expect(mapOsmToCategory('amenity', 'place_of_worship')).toBe('Kirche & Tempel');
      expect(mapOsmToCategory('amenity', 'theatre')).toBe('Theater & Bühne');
      expect(mapOsmToCategory('amenity', 'parking')).toBe('Parkplatz');
      expect(mapOsmToCategory('amenity', 'bus_station')).toBe('Busbahnhof');
    });

    it('maps historic, leisure, shop, natural and transport tags correctly', () => {
      expect(mapOsmToCategory('historic', 'castle')).toBe('Sehenswürdigkeit');
      expect(mapOsmToCategory('historic', 'church')).toBe('Kirche & Tempel');
      expect(mapOsmToCategory('leisure', 'park')).toBe('Park & Garten');
      expect(mapOsmToCategory('leisure', 'playground')).toBe('Spielplatz');
      expect(mapOsmToCategory('leisure', 'sports_centre')).toBe('Sport & Fitness');
      expect(mapOsmToCategory('leisure', 'nature_reserve')).toBe('Natur');
      expect(mapOsmToCategory('leisure', 'beach_resort')).toBe('Strand');
      expect(mapOsmToCategory('leisure', 'spa')).toBe('Wellness & Therme');
      expect(mapOsmToCategory('shop', 'supermarket')).toBe('Supermarkt');
      expect(mapOsmToCategory('shop', 'bakery')).toBe('Bäckerei');
      expect(mapOsmToCategory('shop', 'clothes')).toBe('Shop');
      expect(mapOsmToCategory('natural', 'beach')).toBe('Strand');
      expect(mapOsmToCategory('natural', 'peak')).toBe('Aussichtspunkt');
      expect(mapOsmToCategory('natural', 'wood')).toBe('Natur');
      expect(mapOsmToCategory('aeroway', 'aerodrome')).toBe('Flughafen');
      expect(mapOsmToCategory('railway', 'station')).toBe('Bahnhof');
      expect(mapOsmToCategory('highway', 'bus_stop')).toBe('Busbahnhof');
      expect(mapOsmToCategory('place', 'city')).toBe('Ausflugsziel');
    });

    it('returns empty string for missing or unknown tags', () => {
      expect(mapOsmToCategory()).toBe('');
      expect(mapOsmToCategory('unknown_key', 'unknown_value')).toBe('');
    });
  });

  describe('derivePlaceName & formatAddress', () => {
    it('uses properties.name when available', () => {
      const props = {
        name: 'Café Central',
        street: 'Herrengasse',
        housenumber: '14',
        city: 'Wien',
      };
      expect(derivePlaceName(props)).toBe('Café Central');
    });

    it('derives name from street and housenumber when name is missing', () => {
      const props = {
        street: 'Friedrichstraße',
        housenumber: '100',
        city: 'Berlin',
      };
      expect(derivePlaceName(props)).toBe('Friedrichstraße 100');
    });

    it('falls back to locality or Unbekannter Ort', () => {
      expect(derivePlaceName({ city: 'Hamburg' })).toBe('Hamburg');
      expect(derivePlaceName({})).toBe('Unbekannter Ort');
    });

    it('formats address cleanly without undefined or orphan commas', () => {
      const addr = formatAddress({
        street: 'Philharmonikerstraße',
        housenumber: '4',
        postcode: '1010',
        city: 'Wien',
        country: 'Österreich',
      });
      expect(addr).toBe('Philharmonikerstraße 4, 1010 Wien, Österreich');
    });
  });

  describe('searchPlaces', () => {
    it('returns empty array when query is empty or whitespace', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      expect(await searchPlaces({ q: '' })).toEqual([]);
      expect(await searchPlaces({ q: '   ' })).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches from Photon API and maps coordinates [lon, lat] to { lat, lng }', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [16.3697, 48.204], // [lon, lat]
            },
            properties: {
              osm_type: 'W',
              osm_id: 628990501,
              osm_key: 'tourism',
              osm_value: 'hotel',
              name: 'Hotel Sacher',
              street: 'Philharmonikerstraße',
              housenumber: '4',
              postcode: '1010',
              city: 'Wien',
              country: 'Österreich',
              countrycode: 'AT',
            },
          },
        ],
      };

      let calledUrl = '';
      let calledHeaders: Record<string, string> = {};

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, opts?: RequestInit) => {
          calledUrl = url;
          calledHeaders = (opts?.headers as Record<string, string>) || {};
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          });
        })
      );

      const results = await searchPlaces({ q: 'Hotel Sacher' });

      expect(calledUrl).toContain('https://photon.komoot.io/api/');
      expect(calledUrl).toContain('q=Hotel+Sacher');
      expect(calledHeaders['User-Agent']).toContain('Reisotor/1.0');

      expect(results).toHaveLength(1);
      const place = results[0];
      expect(place.name).toBe('Hotel Sacher');
      // Crucial: GeoJSON [lon, lat] mapped to { lat, lng }
      expect(place.lat).toBe(48.204);
      expect(place.lng).toBe(16.3697);
      expect(place.category).toBe('Unterkunft');
      expect(place.id).toBe('W628990501');
      expect(place.formatted_address).toBe('Philharmonikerstraße 4, 1010 Wien, Österreich');
      expect(place.address).toBe('Philharmonikerstraße 4, 1010 Wien, Österreich');
    });

    it('translates query parameter lng to lon and NEVER sends lng to Photon', async () => {
      let requestedUrl = '';
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          requestedUrl = url;
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
          });
        })
      );

      await searchPlaces({
        q: 'Café',
        lat: 48.208,
        lng: 16.373,
        limit: 8,
      });

      const parsedUrl = new URL(requestedUrl);
      expect(parsedUrl.searchParams.get('q')).toBe('Café');
      expect(parsedUrl.searchParams.get('lat')).toBe('48.208');
      expect(parsedUrl.searchParams.get('lon')).toBe('16.373');
      expect(parsedUrl.searchParams.get('limit')).toBe('8');

      // CRITICAL: Photon rejects 'lng' with HTTP 400. Ensure 'lng' is NOT present!
      expect(parsedUrl.searchParams.has('lng')).toBe(false);
      expect(requestedUrl).not.toContain('lng=');
    });

    it('caches responses in memory and reuses them on identical queries', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [13.4, 52.5] },
                properties: { name: 'Brandenburger Tor' },
              },
            ],
          }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      // First call: should call fetch
      const res1 = await searchPlaces({ q: 'Brandenburger Tor' });
      expect(res1).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second identical call: should hit cache, NOT call fetch
      const res2 = await searchPlaces({ q: 'Brandenburger Tor' });
      expect(res2).toEqual(res1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Clearing cache triggers new fetch
      clearPlacesCache();
      const res3 = await searchPlaces({ q: 'Brandenburger Tor' });
      expect(res3).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      // Alias _clearPlacesCache works as well
      _clearPlacesCache();
      await searchPlaces({ q: 'Brandenburger Tor' });
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('evicts expired cache entries based on TTL (1 hour)', () => {
      const key = buildCacheKey('test');
      const data = [{ name: 'Test', formatted_address: 'Test', address: 'Test', lat: 1, lng: 1 }];

      // Set entry with expired time
      vi.spyOn(Date, 'now').mockReturnValue(1000);
      setCachedPlaces(key, data);
      expect(getCachedPlaces(key)).toEqual(data);

      // Advance time by 1 hour + 1 millisecond
      vi.spyOn(Date, 'now').mockReturnValue(1000 + 60 * 60 * 1000 + 1);
      expect(getCachedPlaces(key)).toBeNull();
    });

    it('enforces LRU capacity limit of 500 entries', () => {
      for (let i = 0; i < 505; i++) {
        const key = `key-${i}`;
        setCachedPlaces(key, [
          { name: `Place ${i}`, formatted_address: 'Addr', address: 'Addr', lat: 0, lng: 0 },
        ]);
      }
      expect(getPlacesCacheSize()).toBeLessThanOrEqual(500);
      // First 5 entries should have been evicted
      expect(getCachedPlaces('key-0')).toBeNull();
      expect(getCachedPlaces('key-1')).toBeNull();
      expect(getCachedPlaces('key-2')).toBeNull();
      expect(getCachedPlaces('key-3')).toBeNull();
      expect(getCachedPlaces('key-4')).toBeNull();
      // Most recent entries should be present
      expect(getCachedPlaces('key-504')).not.toBeNull();
    });

    it('gracefully returns empty array on HTTP error (500, 429, etc.) instead of throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: false, status: 500, statusText: 'Server Error' }))
      );

      const results = await searchPlaces({ q: 'Crash Test' });
      expect(results).toEqual([]);
    });

    it('gracefully returns empty array on network failure or timeout', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network connection aborted (timeout)')))
      );

      const results = await searchPlaces({ q: 'Timeout Test' });
      expect(results).toEqual([]);
    });

    it('skips invalid features missing coordinates gracefully', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: null, properties: { name: 'Invalid 1' } },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: ['invalid', 'coords'] },
            properties: { name: 'Invalid 2' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [10.0, 50.0] },
            properties: { name: 'Valid Place' },
          },
        ],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          })
        )
      );

      const results = await searchPlaces({ q: 'Mixed features' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Valid Place');
      expect(results[0].lat).toBe(50.0);
      expect(results[0].lng).toBe(10.0);
    });
  });

  describe('reverseGeocode', () => {
    it('returns formatted address and place name for valid coordinates', async () => {
      const mockResponse = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [13.3777, 52.5163] },
            properties: {
              name: 'Quadriga mit Victoria',
              street: 'Platz des 18. März',
              postcode: '10117',
              city: 'Berlin',
              country: 'Deutschland',
              osm_key: 'tourism',
              osm_value: 'artwork',
            },
          },
        ],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          })
        )
      );

      const result = await reverseGeocode({ lat: 52.5163, lng: 13.3777 });
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Quadriga mit Victoria');
      expect(result?.formatted_address).toBe('Platz des 18. März, 10117 Berlin, Deutschland');
      expect(result?.category).toBe('Ausflugsziel');
    });

    it('returns null when no features are found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
          })
        )
      );

      const result = await reverseGeocode({ lat: 0, lng: 0 });
      expect(result).toBeNull();
    });

    it('returns null gracefully on network failure', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network failure')))
      );

      const result = await reverseGeocode({ lat: 52.5, lng: 13.4 });
      expect(result).toBeNull();
    });
  });
});
