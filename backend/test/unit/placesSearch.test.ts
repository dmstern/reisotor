import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseLocationQuery,
  scorePlace,
  searchPlaces,
  clearPlacesCache,
  type PlaceSearchResult,
} from '../../src/utils/places.js';

describe('Smart Location Search & Query Parsing (#510)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearPlacesCache();
  });

  describe('parseLocationQuery', () => {
    it('detects "club" category and extracts stripped query for "else club berlin"', () => {
      const parsed = parseLocationQuery('else club berlin');
      expect(parsed.category).toBeDefined();
      expect(parsed.category?.keyword).toBe('club');
      expect(parsed.category?.label).toBe('Nachtleben');
      expect(parsed.category?.tags).toEqual(
        expect.arrayContaining([
          { key: 'amenity', value: 'nightclub' },
          { key: 'amenity', value: 'bar' },
        ])
      );
      expect(parsed.strippedQuery).toBe('else berlin');
      expect(parsed.wantsStreet).toBe(false);
    });

    it('detects "bar" category for "else bar berlin"', () => {
      const parsed = parseLocationQuery('else bar berlin');
      expect(parsed.category).toBeDefined();
      expect(parsed.category?.keyword).toBe('bar');
      expect(parsed.strippedQuery).toBe('else berlin');
    });

    it('detects "nachtleben" category for "else berlin nachtleben"', () => {
      const parsed = parseLocationQuery('else berlin nachtleben');
      expect(parsed.category).toBeDefined();
      expect(parsed.category?.keyword).toBe('nachtleben');
      expect(parsed.strippedQuery).toBe('else berlin');
    });

    it('detects "agentur" category for "init berlin agentur"', () => {
      const parsed = parseLocationQuery('init berlin agentur');
      expect(parsed.category).toBeDefined();
      expect(parsed.category?.keyword).toBe('agentur');
      expect(parsed.category?.label).toBe('Unternehmen');
      expect(parsed.category?.tags).toEqual(
        expect.arrayContaining([{ key: 'office' }, { key: 'office', value: 'company' }])
      );
      expect(parsed.strippedQuery).toBe('init berlin');
    });

    it('cleans special punctuation brackets for "]init[ AG Berlin"', () => {
      const parsed = parseLocationQuery(']init[ AG Berlin');
      expect(parsed.cleaned).toBe('init AG Berlin');
      expect(parsed.cleanedTerms).toEqual(['init', 'ag', 'berlin']);
    });

    it('detects "cafes in ystad" with stop word "in" stripped', () => {
      const parsed = parseLocationQuery('cafes in ystad');
      expect(parsed.category).toBeDefined();
      expect(parsed.category?.keyword).toBe('cafes');
      expect(parsed.category?.label).toBe('Café');
      expect(parsed.strippedQuery).toBe('ystad');
    });

    it('recognizes street search intent for "apotheke elsenstraße"', () => {
      const parsed = parseLocationQuery('apotheke elsenstraße');
      expect(parsed.category?.keyword).toBe('apotheke');
      expect(parsed.wantsStreet).toBe(true);
    });
  });

  describe('scorePlace', () => {
    it('prioritizes category-matching POI over a street with a similar name', () => {
      const parsed = parseLocationQuery('else club berlin');

      const streetCandidate: PlaceSearchResult = {
        name: 'Else-Lasker-Schüler-Straße',
        formatted_address: 'Else-Lasker-Schüler-Straße, 10783 Berlin',
        address: 'Else-Lasker-Schüler-Straße, 10783 Berlin',
        lat: 52.5006,
        lng: 13.357,
        osmKey: 'highway',
        osmValue: 'residential',
      };

      const nightclubCandidate: PlaceSearchResult = {
        id: 'W232536532',
        name: 'Else',
        formatted_address: 'An den Treptowers 10, 12435 Berlin',
        address: 'An den Treptowers 10, 12435 Berlin',
        lat: 52.4952,
        lng: 13.4627,
        category: 'Nachtleben',
        osmKey: 'amenity',
        osmValue: 'nightclub',
      };

      const streetScore = scorePlace(streetCandidate, parsed);
      const clubScore = scorePlace(nightclubCandidate, parsed);

      expect(clubScore).toBeGreaterThan(streetScore);
    });

    it('prioritizes office/company for agency search', () => {
      const parsed = parseLocationQuery('init berlin agentur');

      const companyCandidate: PlaceSearchResult = {
        name: 'Init AG',
        formatted_address: 'Köpenicker Straße 9, 10997 Berlin',
        address: 'Köpenicker Straße 9, 10997 Berlin',
        lat: 52.5035,
        lng: 13.4394,
        category: 'Unternehmen',
        osmKey: 'office',
        osmValue: 'company',
      };

      const employmentAgencyCandidate: PlaceSearchResult = {
        name: 'Agentur für Arbeit',
        formatted_address: 'Charlottenstraße 87, 10969 Berlin',
        address: 'Charlottenstraße 87, 10969 Berlin',
        lat: 52.5054,
        lng: 13.391,
        category: 'Unternehmen',
        osmKey: 'office',
        osmValue: 'employment_agency',
      };

      const companyScore = scorePlace(companyCandidate, parsed);
      const employmentScore = scorePlace(employmentAgencyCandidate, parsed);

      // Company named "Init" matches the search term "init" + category
      expect(companyScore).toBeGreaterThan(employmentScore);
    });
  });

  describe('searchPlaces integration', () => {
    it('executes tag-filtered search and places Else nightclub at top for "else club berlin"', async () => {
      // Mock fetch: primary query returns residential street, tag query returns Else nightclub
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('osm_tag=')) {
            // Secondary tag-filtered response
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      geometry: { type: 'Point', coordinates: [13.4627, 52.4952] },
                      properties: {
                        osm_type: 'W',
                        osm_id: 232536532,
                        osm_key: 'amenity',
                        osm_value: 'nightclub',
                        name: 'Else',
                        street: 'An den Treptowers',
                        housenumber: '10',
                        city: 'Berlin',
                        country: 'Deutschland',
                      },
                    },
                  ],
                }),
            });
          }

          if (url.includes('nominatim')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve([]),
            });
          }

          // Primary Photon response (street)
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [13.357, 52.5006] },
                    properties: {
                      osm_type: 'W',
                      osm_id: 1442161218,
                      osm_key: 'highway',
                      osm_value: 'residential',
                      name: 'Else-Lasker-Schüler-Straße',
                      city: 'Berlin',
                    },
                  },
                ],
              }),
          });
        })
      );

      const results = await searchPlaces({ q: 'else club berlin', limit: 5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Else');
      expect(results[0].category).toBe('Nachtleben');
      expect(results[0].osmValue).toBe('nightclub');
    });

    it('falls back to Nominatim and parses cafe places for "cafes in ystad"', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('nominatim')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  {
                    place_id: 148127855,
                    osm_type: 'node',
                    osm_id: 1680808403,
                    lat: '55.4298',
                    lon: '13.8200',
                    category: 'amenity',
                    type: 'cafe',
                    name: 'Espresso House',
                    display_name: 'Espresso House, Stortorget, Ystad, Sverige',
                    address: {
                      amenity: 'Espresso House',
                      road: 'Stortorget',
                      town: 'Ystad',
                      country: 'Sverige',
                      country_code: 'se',
                    },
                  },
                ]),
            });
          }

          // Primary/tag Photon returns empty
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ type: 'FeatureCollection', features: [] }),
          });
        })
      );

      const results = await searchPlaces({ q: 'cafes in ystad', limit: 5 });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Espresso House');
      expect(results[0].category).toBe('Café');
      expect(results[0].city).toBe('Ystad');
    });

    it('deduplicates identical places returned across multiple providers', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('nominatim')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  {
                    place_id: 999,
                    osm_type: 'node',
                    osm_id: 12345,
                    lat: '52.5200',
                    lon: '13.4050',
                    category: 'amenity',
                    type: 'cafe',
                    name: 'Duplicate Cafe',
                    display_name: 'Duplicate Cafe, Berlin',
                  },
                ]),
            });
          }

          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [13.405, 52.52] },
                    properties: {
                      osm_type: 'N',
                      osm_id: 12345,
                      osm_key: 'amenity',
                      osm_value: 'cafe',
                      name: 'Duplicate Cafe',
                      city: 'Berlin',
                    },
                  },
                ],
              }),
          });
        })
      );

      const results = await searchPlaces({ q: 'cafe berlin', limit: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('N12345');
    });
  });
});
