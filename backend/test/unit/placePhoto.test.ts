import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchPlacePhoto,
  searchWebPlacePhoto,
  clearPhotoCache,
  isGoodPhoto,
  isTitleMatch,
  buildPhotoCacheKey,
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
  });

  describe('buildPhotoCacheKey', () => {
    it('normalizes name, coordinates and city into a consistent key', () => {
      const key1 = buildPhotoCacheKey('  Stephansdom  ', 48.2085, 16.3738, ' Wien ');
      const key2 = buildPhotoCacheKey('stephansdom', 48.2085, 16.3738, 'wien');
      expect(key1).toBe(key2);
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
        if (url.includes('images.search.yahoo.com')) {
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
  });
});
