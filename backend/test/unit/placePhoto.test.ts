import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPlacePhoto,
  fetchPlacePhotos,
  searchWebPlacePhoto,
  clearPhotoCache,
  isGoodPhoto,
  isTitleMatch,
  buildPhotoCacheKey,
  buildSearchQueries,
  isAirportQuery,
} from '../../src/utils/placePhoto.js';

describe('placePhoto utility', () => {
  beforeEach(() => {
    clearPhotoCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isGoodPhoto', () => {
    it('accepts legitimate photo filenames and formats', () => {
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Stephansdom.jpg')).toBe(true);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Eiffel_Tower_2020.jpeg')).toBe(true);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Pergamon_Façade.png')).toBe(true);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../view.webp')).toBe(true);
    });

    it('rejects SVGs, logos, icons, flags, and maps', () => {
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Logo_Cafe_Central.svg')).toBe(false);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Logo_Cafe_Central_edit.svg.png')).toBe(
        false
      );
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Flag_of_Germany.svg')).toBe(false);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Wappen_Berlin.png')).toBe(false);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Location_map_Vienna.jpg')).toBe(false);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Commons-logo.svg')).toBe(false);
      expect(isGoodPhoto('https://upload.wikimedia.org/.../Disambig.svg')).toBe(false);
      expect(isGoodPhoto('')).toBe(false);
    });
  });

  describe('isTitleMatch', () => {
    it('matches exact and contained titles', () => {
      expect(isTitleMatch('Stephansdom', 'Stephansdom')).toBe(true);
      expect(isTitleMatch('Brandenburger Tor', 'Brandenburger Tor')).toBe(true);
      expect(isTitleMatch('Schloss Neuschwanstein', 'Neuschwanstein')).toBe(true);
      expect(isTitleMatch('Café Central (Wien)', 'Café Central', 'Wien')).toBe(true);
    });

    it('rejects title when parenthetical city contradicts target city', () => {
      expect(isTitleMatch('Blumental (Solingen)', 'Blumental', 'Berlin')).toBe(false);
    });

    it('returns false for unrelated titles', () => {
      expect(isTitleMatch('Holocaustleugnung', 'Blumental')).toBe(false);
      expect(isTitleMatch('Alexanderplatz', 'Stephansdom')).toBe(false);
    });

    it('rejects person names and unrelated words for place names', () => {
      expect(isTitleMatch('Steve Franken', 'Franken Bar')).toBe(false);
      expect(isTitleMatch('Steve Franken', 'Franken', 'Berlin')).toBe(false);
    });

    it('rejects general city articles when searching for a specific facility like airport or station', () => {
      expect(isTitleMatch('Lissabon', 'Lissabon (LIS) Flughafen', 'Lissabon')).toBe(false);
      expect(isTitleMatch('Lissabon', 'Flughafen Lissabon', 'Lissabon')).toBe(false);
      expect(isTitleMatch('Berlin', 'Berlin Hauptbahnhof', 'Berlin')).toBe(false);
    });

    it('matches facility articles even with reversed word order or official prefix', () => {
      expect(isTitleMatch('Flughafen Lissabon', 'Lissabon (LIS) Flughafen', 'Lissabon')).toBe(true);
      expect(
        isTitleMatch('Flughafen Humberto Delgado Lissabon', 'Lissabon (LIS) Flughafen', 'Lissabon')
      ).toBe(true);
    });
  });

  describe('isAirportQuery', () => {
    it('detects airport intent from keywords, categories, and IATA codes', () => {
      expect(isAirportQuery('Lissabon (LIS) Flughafen')).toBe(true);
      expect(isAirportQuery('Lissabon (LIS)')).toBe(true);
      expect(isAirportQuery('Berlin (BER)')).toBe(true);
      expect(isAirportQuery('Airport JFK')).toBe(true);
      expect(isAirportQuery('Aeroporto de Lisboa')).toBe(true);
      expect(isAirportQuery('Lissabon', 'Flughafen')).toBe(true);
      expect(isAirportQuery('Lissabon', 'Airport')).toBe(true);
      expect(isAirportQuery('Lissabon', 'Ausflugsziel')).toBe(false);
      expect(isAirportQuery('Stephansdom', 'Kirche')).toBe(false);
    });
  });

  describe('buildPhotoCacheKey', () => {
    it('normalizes name, coordinates and city into a consistent key', () => {
      const key1 = buildPhotoCacheKey('  Stephansdom  ', 48.2085, 16.3738, ' Wien ');
      const key2 = buildPhotoCacheKey('stephansdom', 48.2085, 16.3738, 'wien');
      expect(key1).toBe(key2);
    });

    it('distinguishes banner queries from spot queries to prevent cache collisions', () => {
      const spotKey = buildPhotoCacheKey(
        'Lissabon',
        undefined,
        undefined,
        undefined,
        undefined,
        false
      );
      const bannerKey = buildPhotoCacheKey(
        'Lissabon',
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      expect(spotKey).not.toBe(bannerKey);
      expect(bannerKey).toContain('banner');
      expect(spotKey).toContain('spot');
    });
  });

  describe('buildSearchQueries', () => {
    it('generates cascading queries from specific to broad', () => {
      const queries = buildSearchQueries('Trinkteufel', 'Berlin', 'Nachtleben');
      expect(queries).toEqual([
        'Trinkteufel Berlin Nachtleben',
        'Trinkteufel Berlin',
        'Trinkteufel',
      ]);
    });

    it('handles query strings that already contain city and category', () => {
      const queries = buildSearchQueries('Trinkteufel Berlin Nachtleben', 'Berlin', 'Nachtleben');
      expect(queries).toEqual([
        'Trinkteufel Berlin Nachtleben',
        'Trinkteufel Berlin',
        'Trinkteufel',
      ]);
    });

    it('falls back to bare name when city and category are absent', () => {
      const queries = buildSearchQueries('Sesamstraße');
      expect(queries).toEqual(['Sesamstraße']);
    });

    it('handles category differences with accents (Café vs Cafe) and words in middle', () => {
      const queries = buildSearchQueries('Froindlichst Berlin Cafe', 'Berlin', 'Café');
      expect(queries).toEqual(['Froindlichst Berlin Cafe', 'Froindlichst Berlin', 'Froindlichst']);

      const barQueries = buildSearchQueries('Else Bar Berlin', 'Berlin', 'Bar');
      expect(barQueries).toEqual(['Else Bar Berlin', 'Else Berlin', 'Else']);
    });

    it('generates focused airport queries without degrading to bare city names', () => {
      const airportQueries = buildSearchQueries(
        'Lissabon (LIS) Flughafen',
        'Lissabon',
        'Flughafen'
      );
      expect(airportQueries).toContain('Flughafen Lissabon (LIS)');
      expect(airportQueries).toContain('Lissabon Airport LIS');
      expect(airportQueries).toContain('Airport LIS');
      // Must NOT contain bare "Lissabon" or "(LIS)"
      expect(airportQueries).not.toContain('Lissabon');
      expect(airportQueries).not.toContain('(LIS)');

      const codeQueries = buildSearchQueries('Lissabon (LIS)');
      expect(codeQueries).toContain('Flughafen Lissabon (LIS)');
      expect(codeQueries).toContain('Lissabon Airport LIS');
      expect(codeQueries).not.toContain('Lissabon');
    });
  });

  describe('searchWebPlacePhoto', () => {
    it('extracts original photo URL from web search HTML', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div id="resitem-0">
                  <a data-origurl="https://media-cdn.tripadvisor.com/media/photo-s/frankenbar.jpg"
                     data-referenceurl="https://www.tripadvisor.de/Attraction_Review-frankenbar.html">
                    <img src="https://tse4.mm.bing.net/th/id/OIP.thumb.jpg" />
                  </a>
                </div>`
              ),
          })
        )
      );

      const photo = await searchWebPlacePhoto('Franken Bar', 'Berlin');
      expect(photo).toBe('https://media-cdn.tripadvisor.com/media/photo-s/frankenbar.jpg');
    });

    it('falls back to thumbnail URL if original URL is an SVG or logo', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div id="resitem-0">
                  <a data-origurl="https://example.com/logo.svg"
                     data-referenceurl="https://example.com/cafe">
                    <img src="https://tse4.mm.bing.net/th/id/OIP.thumb.jpg" />
                    <p class="tile-title">Café am Engelbecken</p>
                  </a>
                </div>`
              ),
          })
        )
      );

      const photo = await searchWebPlacePhoto('Café', 'Berlin');
      expect(photo).toBe('https://tse4.mm.bing.net/th/id/OIP.thumb.jpg');
    });

    it('returns null on network error or empty results', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network error')))
      );

      const photo = await searchWebPlacePhoto('Unknown Bar');
      expect(photo).toBeNull();
    });
  });

  describe('fetchPlacePhoto', () => {
    it('returns photo from Wikipedia GeoSearch when coordinates match and title matches', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('geosearch')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  query: {
                    pages: {
                      '1': {
                        pageid: 1,
                        title: 'Stephansdom',
                        thumbnail: {
                          source:
                            'https://thumb.wikimedia.org/wikipedia/commons/thumb/stephansdom.jpg',
                          width: 800,
                          height: 600,
                        },
                        pageimage: 'stephansdom.jpg',
                      },
                    },
                  },
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        })
      );

      const photo = await fetchPlacePhoto({
        name: 'Stephansdom',
        lat: 48.2085,
        lng: 16.3738,
        city: 'Wien',
      });

      expect(photo).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/stephansdom.jpg');
    });

    it('returns photo from Wikipedia Search when GeoSearch has no match', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('geosearch')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ query: { pages: {} } }),
            });
          }
          if (url.includes('action=query') && url.includes('generator=search')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  query: {
                    pages: {
                      '10': {
                        pageid: 10,
                        title: 'Eiffelturm',
                        index: 1,
                        thumbnail: {
                          source: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/eiffel.jpg',
                          width: 800,
                          height: 600,
                        },
                        pageimage: 'eiffel.jpg',
                      },
                    },
                  },
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        })
      );

      const photo = await fetchPlacePhoto({
        name: 'Eiffelturm',
        city: 'Paris',
      });

      expect(photo).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/eiffel.jpg');
    });

    it('resolves real photo from article images if lead image is an SVG logo', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('generator=search')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  query: {
                    pages: {
                      '20': {
                        pageid: 20,
                        title: 'Café Central',
                        index: 1,
                        thumbnail: {
                          source:
                            'https://thumb.wikimedia.org/wikipedia/commons/thumb/Logo_Cafe_Central.svg/1000px-Logo.png',
                          width: 800,
                          height: 600,
                        },
                        pageimage: 'Logo_Cafe_Central.svg',
                        images: [
                          { title: 'Datei:Commons-logo.svg' },
                          { title: 'Datei:Cafe Central Innenansicht.jpg' },
                        ],
                      },
                    },
                  },
                }),
            });
          }
          if (url.includes('prop=imageinfo')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  query: {
                    pages: {
                      '21': {
                        imageinfo: [
                          {
                            thumburl:
                              'https://thumb.wikimedia.org/wikipedia/commons/thumb/Cafe_Central_Innenansicht.jpg',
                          },
                        ],
                      },
                    },
                  },
                }),
            });
          }
          return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        })
      );

      const photo = await fetchPlacePhoto({
        name: 'Café Central',
        city: 'Wien',
      });

      expect(photo).toBe(
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/Cafe_Central_Innenansicht.jpg'
      );
    });

    it('returns null when no matching place or photo is found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) })
        )
      );

      const photo = await fetchPlacePhoto({
        name: 'Musterplatz Unbekannt 99',
        lat: 52.0,
        lng: 13.0,
      });

      expect(photo).toBeNull();
    });

    it('handles network timeouts and errors gracefully without throwing', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Connection timeout')))
      );

      const photo = await fetchPlacePhoto({
        name: 'Brandenburger Tor',
      });

      expect(photo).toBeNull();
    });

    it('uses cached results on repeated calls', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              query: {
                pages: {
                  '1': {
                    pageid: 1,
                    title: 'Brandenburger Tor',
                    index: 1,
                    thumbnail: {
                      source: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/tor.jpg',
                      width: 800,
                      height: 600,
                    },
                    pageimage: 'tor.jpg',
                  },
                },
              },
            }),
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const photo1 = await fetchPlacePhoto({ name: 'Brandenburger Tor' });
      expect(photo1).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/tor.jpg');
      expect(fetchMock).toHaveBeenCalled();

      fetchMock.mockClear();
      const photo2 = await fetchPlacePhoto({ name: 'Brandenburger Tor' });
      expect(photo2).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/tor.jpg');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('prefers web image search before falling back to Wikipedia', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes('bing.com') || url.includes('images.search.yahoo.com')) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div id="resitem-0">
                  <a data-origurl="https://media-cdn.tripadvisor.com/media/photo-s/bar.jpg"
                     data-referenceurl="https://www.tripadvisor.de/bar.html">
                    <img src="https://tse4.mm.bing.net/th/id/thumb.jpg" />
                    <p class="tile-title">Franken Bar (Berlin)</p>
                  </a>
                </div>`
              ),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) });
      });
      vi.stubGlobal('fetch', fetchMock);

      const photo = await fetchPlacePhoto({ name: 'Franken Bar', city: 'Berlin' });
      expect(photo).toBe('https://media-cdn.tripadvisor.com/media/photo-s/bar.jpg');
    });

    it('includes category in web search query and parses Bing iusc JSON attributes', async () => {
      let calledUrl = '';
      const fetchMock = vi.fn((url: string) => {
        calledUrl = url;
        if (url.includes('bing.com')) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div class="iusc" style="height:198px;width:264px" m="{&quot;murl&quot;:&quot;https://example.com/trinkteufel.jpg&quot;,&quot;turl&quot;:&quot;https://ts4.mm.bing.net/th?id=OIP.123&quot;,&quot;t&quot;:&quot;Trinkteufel Kreuzberg Berlin&quot;,&quot;purl&quot;:&quot;https://kreuzberg24.net/trinkteufel&quot;}"></div>`
              ),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) });
      });
      vi.stubGlobal('fetch', fetchMock);

      const photo = await fetchPlacePhoto({
        name: 'Trinkteufel',
        city: 'Berlin',
        category: 'Nachtleben',
      });
      expect(calledUrl).toContain('Trinkteufel');
      expect(calledUrl).toContain('Berlin');
      expect(calledUrl).toContain('Nachtleben');
      expect(photo).toBe('https://ts4.mm.bing.net/th?id=OIP.123&w=1000');
    });

    it('prioritizes original murl for banner requests while using turl for spots', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes('bing.com')) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div class="iusc" style="height:198px;width:264px" m="{&quot;murl&quot;:&quot;https://cdn.example.com/lissabon_original_highres.jpg&quot;,&quot;turl&quot;:&quot;https://ts2.mm.bing.net/th?id=OIP.thumb&quot;,&quot;t&quot;:&quot;Sommerurlaub Lissabon Panorama&quot;,&quot;purl&quot;:&quot;https://travel.example.com/lisbon&quot;}"></div>`
              ),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) });
      });
      vi.stubGlobal('fetch', fetchMock);

      // Banner request: muss murl (Originalbild) bevorzugen
      const bannerPhoto = await fetchPlacePhoto({
        name: 'Sommerurlaub Lissabon',
        isBanner: true,
      });
      expect(bannerPhoto).toBe('https://cdn.example.com/lissabon_original_highres.jpg');

      // Spot request: muss turl (kleineres Edge-CDN-Thumbnail) bevorzugen, um Speicherplatz zu sparen
      const spotPhoto = await fetchPlacePhoto({
        name: 'Sommerurlaub Lissabon',
        isBanner: false,
      });
      expect(spotPhoto).toBe('https://ts2.mm.bing.net/th?id=OIP.thumb&w=1000');
    });

    it('falls back to murl if Bing turl is missing or invalid', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div class="iusc" style="height:198px;width:264px" m="{&quot;murl&quot;:&quot;https://example.com/trinkteufel_direct.jpg&quot;,&quot;t&quot;:&quot;Trinkteufel Kreuzberg Berlin&quot;}"></div>`
              ),
          })
        )
      );

      const photo = await fetchPlacePhoto({
        name: 'Trinkteufel',
        city: 'Berlin',
      });
      expect(photo).toBe('https://example.com/trinkteufel_direct.jpg');
    });

    it('falls back to DuckDuckGo when Bing search fails or returns no results', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes('bing.com')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<html><body>Keine Ergebnisse</body></html>'),
          });
        }
        if (url.includes('duckduckgo.com/?q=')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve('<html><script>vqd="4-123456789"</script></html>'),
          });
        }
        if (url.includes('duckduckgo.com/i.js')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                results: [
                  {
                    title: 'Else Open Air Club Berlin',
                    image: 'https://example.com/else_ddg.jpg',
                    thumbnail: 'https://tse1.mm.bing.net/th/id/thumb.jpg',
                    url: 'https://example.com/else',
                  },
                ],
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) });
      });
      vi.stubGlobal('fetch', fetchMock);

      const photo = await fetchPlacePhoto({
        name: 'Else Berlin Kneipe',
        city: 'Berlin',
        category: 'Kneipe',
      });
      expect(photo).toBe('https://example.com/else_ddg.jpg');
    });

    it('falls back to Wikimedia Commons image search when web search and Wikipedia have no match', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes('bing.com') || url.includes('duckduckgo.com')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(''),
          });
        }
        if (url.includes('wikipedia.org')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ query: { pages: {} } }),
          });
        }
        if (url.includes('commons.wikimedia.org')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                query: {
                  pages: {
                    '100': {
                      pageid: 100,
                      title: 'File:Flughafen BER Terminal 1.jpg',
                      imageinfo: [
                        {
                          thumburl: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/ber.jpg',
                          url: 'https://upload.wikimedia.org/wikipedia/commons/ber.jpg',
                        },
                      ],
                    },
                  },
                },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      });
      vi.stubGlobal('fetch', fetchMock);

      const photo = await fetchPlacePhoto({
        name: 'Flughafen BER',
        city: 'Berlin',
      });
      expect(photo).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/ber.jpg');
    });

    it('does not cache empty results so subsequent searches can retry', async () => {
      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ query: { pages: {} } }),
          text: () => Promise.resolve(''),
        })
      );
      vi.stubGlobal('fetch', fetchMock);

      const photo1 = await fetchPlacePhoto({ name: 'Unbekannter Ort XYZ' });
      expect(photo1).toBeNull();
      expect(fetchMock).toHaveBeenCalled();

      fetchMock.mockClear();
      const photo2 = await fetchPlacePhoto({ name: 'Unbekannter Ort XYZ' });
      expect(photo2).toBeNull();
      // Should retry fetch because empty results are not cached for 24h
      expect(fetchMock).toHaveBeenCalled();
    });

    it('filters out generic city photos and prefers actual airport photos when searching for airports', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.includes('bing.com')) {
          return Promise.resolve({
            ok: true,
            text: () =>
              Promise.resolve(
                `<div class="iusc" m="{&quot;murl&quot;:&quot;https://example.com/castelo.jpg&quot;,&quot;turl&quot;:&quot;https://ts1.mm.bing.net/th?id=castelo&quot;,&quot;t&quot;:&quot;Castelo de Sao Jorge Lissabon Panorama&quot;,&quot;purl&quot;:&quot;https://lisbon-guide.com/castelo&quot;}"></div>
                 <div class="iusc" m="{&quot;murl&quot;:&quot;https://example.com/belem.jpg&quot;,&quot;turl&quot;:&quot;https://ts2.mm.bing.net/th?id=belem&quot;,&quot;t&quot;:&quot;Torre de Belem Lissabon Wahrzeichen&quot;,&quot;purl&quot;:&quot;https://lisbon-guide.com/belem&quot;}"></div>
                 <div class="iusc" m="{&quot;murl&quot;:&quot;https://example.com/airport.jpg&quot;,&quot;turl&quot;:&quot;https://ts3.mm.bing.net/th?id=airport&quot;,&quot;t&quot;:&quot;Flughafen Lissabon Humberto Delgado Terminal LIS&quot;,&quot;purl&quot;:&quot;https://lisbon-airport.com/terminal&quot;}"></div>`
              ),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { pages: {} } }) });
      });
      vi.stubGlobal('fetch', fetchMock);

      const photos = await fetchPlacePhotos({
        name: 'Lissabon (LIS) Flughafen',
        city: 'Lissabon',
        category: 'Flughafen',
      });

      // City attractions (Castelo, Belem) must be filtered out; airport photo must be returned
      expect(photos).toContain('https://ts3.mm.bing.net/th?id=airport&w=1000');
      expect(photos).not.toContain('https://ts1.mm.bing.net/th?id=castelo&w=1000');
      expect(photos).not.toContain('https://ts2.mm.bing.net/th?id=belem&w=1000');
    });
  });
});
