import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';
import { clearPlacesCache } from '../../src/utils/places.js';

describe('GET /api/places/search route', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;

    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('places_user', bcrypt.hashSync('testpass123', 10), '🌍');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'places_user', password: 'testpass123' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearPlacesCache();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=Berlin',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects missing or empty query string with 400', async () => {
    // Missing q
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/places/search',
      headers: { cookie },
    });
    expect(res1.statusCode).toBe(400);

    // Empty q
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=',
      headers: { cookie },
    });
    expect(res2.statusCode).toBe(400);

    // Whitespace only q
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=%20%20%20',
      headers: { cookie },
    });
    expect(res3.statusCode).toBe(400);
  });

  it('returns 200 with mapped place results when authenticated and query is valid', async () => {
    const mockPhotonResponse = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [13.405, 52.52], // [lon, lat]
          },
          properties: {
            osm_type: 'N',
            osm_id: 123456,
            osm_key: 'tourism',
            osm_value: 'attraction',
            name: 'Fernsehturm',
            street: 'Panoramastraße',
            housenumber: '1A',
            postcode: '10178',
            city: 'Berlin',
            country: 'Deutschland',
          },
        },
      ],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPhotonResponse),
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=Fernsehturm&lat=52.52&lng=13.405&limit=5',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);

    const place = body[0];
    expect(place.name).toBe('Fernsehturm');
    expect(place.lat).toBe(52.52);
    expect(place.lng).toBe(13.405);
    expect(place.category).toBe('Sehenswürdigkeit');
    expect(place.formatted_address).toBe('Panoramastraße 1A, 10178 Berlin, Deutschland');
    expect(place.address).toBe('Panoramastraße 1A, 10178 Berlin, Deutschland');
    expect(place.id).toBe('N123456');
  });

  it('returns empty array 200 instead of 500 when upstream Photon service fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
      )
    );

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=CrashTest',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('clamps limit to maximum of 10', async () => {
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

    const res = await app.inject({
      method: 'GET',
      url: '/api/places/search?q=Wien&limit=50',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const parsed = new URL(requestedUrl);
    expect(parsed.searchParams.get('limit')).toBe('10');
  });

  describe('GET /api/places/reverse', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/places/reverse?lat=52.5163&lng=13.3777',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects missing coordinates with 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/places/reverse',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns reverse geocoded place details for valid coordinates', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
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
                    },
                  },
                ],
              }),
          })
        )
      );

      const res = await app.inject({
        method: 'GET',
        url: '/api/places/reverse?lat=52.5163&lng=13.3777',
        headers: { cookie },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.name).toBe('Quadriga mit Victoria');
      expect(data.formatted_address).toBe('Platz des 18. März, 10117 Berlin, Deutschland');
    });
  });
});
