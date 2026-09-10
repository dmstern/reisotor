import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPlacePreview,
  isSafeUrl,
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

  it('prevents redirect SSRF by not following redirects to internal/private targets', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === 'https://maps.app.goo.gl/redirect-attack') {
        return Promise.resolve({
          url: 'https://maps.app.goo.gl/redirect-attack',
          status: 302,
          headers: {
            get: (h: string) =>
              h.toLowerCase() === 'location' ? 'http://127.0.0.1:8080/secret' : null,
          },
          text: () => Promise.resolve(''),
        });
      }
      if (url.includes('127.0.0.1')) {
        throw new Error('SSRF vulnerability: fetch was called on loopback address!');
      }
      return Promise.resolve({
        url,
        headers: { get: () => null },
        text: () => Promise.resolve(''),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPlacePreview('https://maps.app.goo.gl/redirect-attack');
    expect(result).toEqual({ name: null, imageUrl: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://maps.app.goo.gl/redirect-attack',
      expect.anything()
    );
  });
});

describe('isSafeUrl', () => {
  it('rejects loopback addresses', () => {
    expect(isSafeUrl('http://localhost')).toBe(false);
    expect(isSafeUrl('http://localhost:3000')).toBe(false);
    expect(isSafeUrl('http://127.0.0.1')).toBe(false);
    expect(isSafeUrl('http://127.0.0.1:3000/api')).toBe(false);
    expect(isSafeUrl('http://127.0.0.2')).toBe(false);
    expect(isSafeUrl('http://[::1]')).toBe(false);
    expect(isSafeUrl('http://[::]')).toBe(false);
  });

  it('rejects private IPv4 ranges', () => {
    expect(isSafeUrl('http://10.0.0.1')).toBe(false);
    expect(isSafeUrl('http://10.255.255.255')).toBe(false);
    expect(isSafeUrl('http://172.16.0.1')).toBe(false);
    expect(isSafeUrl('http://172.31.255.255')).toBe(false);
    expect(isSafeUrl('http://192.168.0.1')).toBe(false);
    expect(isSafeUrl('http://192.168.1.1')).toBe(false);
  });

  it('rejects special and internal IPv4 ranges', () => {
    expect(isSafeUrl('http://0.0.0.0')).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeUrl('http://100.64.0.1')).toBe(false); // Carrier-grade NAT
    expect(isSafeUrl('http://100.127.255.255')).toBe(false);
    expect(isSafeUrl('http://198.18.0.1')).toBe(false); // Benchmarking
    expect(isSafeUrl('http://224.0.0.1')).toBe(false); // Multicast
    expect(isSafeUrl('http://240.0.0.1')).toBe(false); // Reserved
    expect(isSafeUrl('http://255.255.255.255')).toBe(false); // Broadcast
  });

  it('rejects private, link-local and mapped IPv6 ranges', () => {
    expect(isSafeUrl('http://[fe80::1]')).toBe(false);
    expect(isSafeUrl('http://[fc00::1]')).toBe(false);
    expect(isSafeUrl('http://[fd12:3456::1]')).toBe(false);
    expect(isSafeUrl('http://[fec0::1]')).toBe(false);
    // IPv4-mapped IPv6
    expect(isSafeUrl('http://[::ffff:127.0.0.1]')).toBe(false);
    expect(isSafeUrl('http://[::ffff:7f00:1]')).toBe(false);
    expect(isSafeUrl('http://[::ffff:169.254.169.254]')).toBe(false);
    expect(isSafeUrl('http://[::ffff:a9fe:a9fe]')).toBe(false);
    expect(isSafeUrl('http://[::ffff:10.0.0.1]')).toBe(false);
    expect(isSafeUrl('http://[::ffff:192.168.1.1]')).toBe(false);
  });

  it('rejects single-label intranet hostnames and internal suffixes', () => {
    expect(isSafeUrl('http://router')).toBe(false);
    expect(isSafeUrl('http://printer/status')).toBe(false);
    expect(isSafeUrl('http://nas.local')).toBe(false);
    expect(isSafeUrl('http://server.internal')).toBe(false);
    expect(isSafeUrl('http://gateway.lan')).toBe(false);
    expect(isSafeUrl('http://device.home.arpa')).toBe(false);
  });

  it('rejects wildcard DNS rebinding domains', () => {
    expect(isSafeUrl('http://127.0.0.1.nip.io')).toBe(false);
    expect(isSafeUrl('http://localtest.me')).toBe(false);
    expect(isSafeUrl('http://localtest.me:3000')).toBe(false);
    expect(isSafeUrl('http://test.sslip.io')).toBe(false);
  });

  it('rejects non-http schemes and URLs with credentials', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('gopher://localhost:11211')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('http://admin:secret@maps.google.com')).toBe(false);
    expect(isSafeUrl('not a url')).toBe(false);
  });

  it('allows valid public Google and Apple Maps URLs', () => {
    expect(isSafeUrl('https://maps.google.com/?q=48.1,16.2')).toBe(true);
    expect(isSafeUrl('https://maps.app.goo.gl/abc123xyz')).toBe(true);
    expect(isSafeUrl('https://www.google.com/maps/@48.2082,16.3738,15z')).toBe(true);
    expect(isSafeUrl('https://maps.apple.com/?coordinate=48.2082,16.3738')).toBe(true);
  });
});
