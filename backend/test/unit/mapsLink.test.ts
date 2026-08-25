import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPlacePreview,
  parseLatLngFromText,
  resolveLatLng,
  tilePreviewUrl,
} from '../../src/utils/mapsLink.js';

describe('parseLatLngFromText', () => {
  it('prefers !3d/!4d over a leading @lat,lng (regression: !3d/!4d is the real pin, @ is just the map viewport)', () => {
    const url = 'https://www.google.com/maps/place/@40.0,10.0,15z/data=!3d48.2082!4d16.3738';
    expect(parseLatLngFromText(url)).toEqual({ lat: 48.2082, lng: 16.3738 });
  });

  it('parses a plain @lat,lng URL', () => {
    expect(parseLatLngFromText('https://www.google.com/maps/@48.2082,16.3738,15z')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses Apple Maps coordinate= param', () => {
    expect(parseLatLngFromText('https://maps.apple.com/?coordinate=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses a %2C-encoded comma in coordinate=', () => {
    expect(parseLatLngFromText('https://maps.apple.com/?coordinate=48.2082%2C16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('parses ?ll= and ?q= variants', () => {
    expect(parseLatLngFromText('https://maps.example/?ll=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
    expect(parseLatLngFromText('https://maps.example/?q=48.2082,16.3738')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('falls back to the raw text on malformed percent-encoding instead of throwing', () => {
    expect(() => parseLatLngFromText('https://maps.example/?q=48.2082,16.3738%')).not.toThrow();
    expect(parseLatLngFromText('https://maps.example/?q=48.2082,16.3738%')).toEqual({
      lat: 48.2082,
      lng: 16.3738,
    });
  });

  it('returns null when no pattern matches', () => {
    expect(parseLatLngFromText('https://maps.app.goo.gl/abc123')).toBeNull();
    expect(parseLatLngFromText('not a maps link at all')).toBeNull();
  });
});

describe('tilePreviewUrl', () => {
  it('computes the expected OSM tile x/y for a known coordinate/zoom', () => {
    expect(tilePreviewUrl(48.2082, 16.3738, 15)).toBe(
      'https://tile.openstreetmap.org/15/17874/11362.png'
    );
  });
});

// Regressionsnetz für resolveLatLng()'s serverseitige Kurzlink-Auflösung (siehe dortiger Kommentar):
// zuerst nur die Redirect-Header Hop für Hop lesen (resolveViaRedirectHeaders, ruft nie die volle,
// bot-erkennungs-anfällige Zielseite ab), erst danach als Fallback der vollständige Redirect-Follow.
// Kein echtes Netzwerk nötig - fetch() ist gemockt (gleiches Muster wie regionInfo.test.ts).
describe('resolveLatLng', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockResponse(overrides: { location?: string | null; url?: string }) {
    return {
      url: overrides.url ?? '',
      headers: {
        get: (name: string) => (name === 'location' ? (overrides.location ?? null) : null),
      },
    };
  }

  it('resolves via the Location header chain alone, without ever fetching the final page', async () => {
    const fetchMock = vi.fn((url: string, options: { redirect?: string }) => {
      expect(options.redirect).toBe('manual');
      if (url === 'https://maps.app.goo.gl/abc123') {
        // Erster Hop: Zwischen-Redirect ohne Koordinate in der Ziel-URL.
        return Promise.resolve(
          mockResponse({ location: 'https://www.google.com/maps/consent?continue=xyz' })
        );
      }
      if (url === 'https://www.google.com/maps/consent?continue=xyz') {
        // Zweiter Hop: die eigentliche Ziel-URL, Koordinate direkt im Location-Header.
        return Promise.resolve(
          mockResponse({ location: 'https://www.google.com/maps/@48.2082,16.3738,15z' })
        );
      }
      return Promise.reject(new Error('unexpected URL in test: ' + url));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveLatLng('https://maps.app.goo.gl/abc123');

    expect(result).toEqual({ lat: 48.2082, lng: 16.3738 });
    // Genau zwei Hops, kein dritter Aufruf (der volle redirect:'follow'-Fallback) nötig.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to a full redirect-follow when no Location header yields coordinates', async () => {
    const fetchMock = vi.fn((url: string, options: { redirect?: string }) => {
      if (options.redirect === 'manual') {
        // Kein Location-Header mehr (z. B. direkt eine 200-Antwort) - resolveViaRedirectHeaders
        // muss hier aufgeben, statt endlos weiterzusuchen.
        return Promise.resolve(mockResponse({ location: null }));
      }
      // Fallback-Pfad: die volle, bereits aufgelöste Ziel-URL tragen Koordinaten.
      return Promise.resolve(
        mockResponse({ url: 'https://www.google.com/maps/@40.7128,-74.006,15z' })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveLatLng('https://maps.app.goo.gl/xyz789');

    expect(result).toEqual({ lat: 40.7128, lng: -74.006 });
  });

  it('gives up after a bounded number of redirect hops instead of looping forever', async () => {
    let manualCalls = 0;
    const fetchMock = vi.fn((url: string, options: { redirect?: string }) => {
      if (options.redirect === 'manual') {
        manualCalls++;
        // Jeder Hop verweist ohne Koordinate auf den nächsten - simuliert eine (defekte) Redirect-Schleife.
        return Promise.resolve(
          mockResponse({ location: `https://example.com/hop-${manualCalls}` })
        );
      }
      return Promise.resolve(mockResponse({ url: 'https://example.com/final-without-coords' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveLatLng('https://maps.app.goo.gl/loop');

    expect(result).toBeNull();
    // Begrenzt auf MAX_REDIRECT_HOPS statt endlos zu folgen.
    expect(manualCalls).toBeLessThanOrEqual(5);
  });

  it('returns null on a network error instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down')))
    );

    await expect(resolveLatLng('https://maps.app.goo.gl/offline')).resolves.toBeNull();
  });
});

// Regressionsnetz für fetchPlacePreview() (ExcursionsView.vue's Live-Vorschau beim Anlegen eines
// Spots): Titel aus dem /maps/place/-URL-Pfad-Segment, Foto aus dem og:image-Meta-Tag der Zielseite.
describe('fetchPlacePreview', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('extracts the place name from the resolved URL and the photo from og:image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          url: 'https://www.google.com/maps/place/Caf%C3%A9+Central/@48.2082,16.3738,17z',
          text: () =>
            Promise.resolve(
              '<html><head><meta property="og:image" content="https://lh3.googleusercontent.com/photo123"></head></html>'
            ),
        })
      )
    );

    const preview = await fetchPlacePreview('https://maps.app.goo.gl/abc');

    expect(preview).toEqual({
      name: 'Café Central',
      imageUrl: 'https://lh3.googleusercontent.com/photo123',
    });
  });

  it('returns empty fields when the URL has no /maps/place/ segment or og:image tag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          url: 'https://www.google.com/maps/@48.2082,16.3738,17z',
          text: () => Promise.resolve('<html><head></head></html>'),
        })
      )
    );

    const preview = await fetchPlacePreview('https://maps.app.goo.gl/abc');

    expect(preview).toEqual({ name: null, imageUrl: null });
  });

  it('returns empty fields on a network error instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down')))
    );

    await expect(fetchPlacePreview('https://maps.app.goo.gl/abc')).resolves.toEqual({
      name: null,
      imageUrl: null,
    });
  });

  it('returns empty fields for a missing URL without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPlacePreview(null)).resolves.toEqual({ name: null, imageUrl: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
