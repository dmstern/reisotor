import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('trips routes', () => {
  let app: FastifyInstance;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('testuser', bcrypt.hashSync('correct-horse', 10), '🧪');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves lat/lng from a parseable maps_link and auto-fills image_url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Lissabon',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        maps_link: 'https://www.google.com/maps/@38.7223,-9.1393,15z',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.lat).toBeCloseTo(38.7223);
    expect(body.lng).toBeCloseTo(-9.1393);
    expect(body.image_url).toContain('tile.openstreetmap.org');
  });

  it('keeps explicit lat/lng untouched when given directly (no maps_link needed)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Direkt',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        lat: 1.5,
        lng: 2.5,
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ lat: 1.5, lng: 2.5 });
  });

  it('retains existing coordinates when the maps_link on update does not parse (network fallback stubbed to avoid a real fetch)', async () => {
    // parseLatLngFromText findet in einem nicht-URL-artigen String kein Muster, resolveLatLng würde
    // danach einen echten fetch()-Fallback versuchen (Kurzlink-Redirect-Auflösung) - hier gemockt,
    // damit der Test garantiert ohne Netzwerkzugriff läuft statt nur zufällig schnell zu scheitern.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network disabled in tests')));

    const created = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Mit Koordinaten',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        lat: 10,
        lng: 20,
      },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/trips/${id}`,
      headers: { cookie },
      payload: {
        name: 'Mit Koordinaten',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        maps_link: 'kaputter-nicht-parsebarer-link',
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ lat: 10, lng: 20 });
  });

  it('clears lat/lng when maps_link is explicitly emptied on update', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Wird geleert',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        lat: 5,
        lng: 6,
      },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/trips/${id}`,
      headers: { cookie },
      payload: {
        name: 'Wird geleert',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        maps_link: '',
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ lat: null, lng: null });
  });

  // Mitgliedschaft (tripAccess.ts) wird vor dem Existenz-Check geprüft: eine Person ohne
  // trip_members-Zeile für 999999 bekommt 403 statt 404, egal ob der Urlaub existiert oder nicht
  // (verrät damit nicht, ob eine fremde id überhaupt existiert).
  it('returns 403 when updating a non-existent (and therefore inaccessible) trip', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/trips/999999',
      headers: { cookie },
      payload: { name: 'x', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    expect(res.statusCode).toBe(403);
  });

  // Reiseregion-Infos (utils/regionInfo.ts): Auth-Gating der neuen Route + Fallback-Antwort ohne
  // Koordinaten (kein Reverse-Geocoding möglich, also auch kein Ländercode) + der eigentliche
  // Reverse-Geocoding-/Region-Info-Pfad mit gemocktem fetch (kein echtes Netzwerk in Tests).
  describe('GET /trips/:id/region-info', () => {
    it('requires membership', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/trips',
        headers: { cookie },
        payload: { name: 'Regions-Trip', start_date: '2026-02-01', end_date: '2026-02-05' },
      });
      const id = created.json().id;

      const outsiderRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'region-outsider',
          email: 'region-outsider@example.com',
          password: 'correct-horse',
        },
      });
      const outsiderCookie = Array.isArray(outsiderRes.headers['set-cookie'])
        ? outsiderRes.headers['set-cookie'].join('; ')
        : String(outsiderRes.headers['set-cookie']);

      const forbidden = await app.inject({
        method: 'GET',
        url: `/api/trips/${id}/region-info`,
        headers: { cookie: outsiderCookie },
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('returns an empty result when the trip has no coordinates (no country to resolve)', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/trips',
        headers: { cookie },
        payload: { name: 'Ohne Koordinaten', start_date: '2026-02-01', end_date: '2026-02-05' },
      });
      const id = created.json().id;

      const res = await app.inject({
        method: 'GET',
        url: `/api/trips/${id}/region-info`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        countryName: null,
        languages: [],
        currency: null,
        exchangeRate: null,
        advisory: null,
      });
    });

    it('resolves the country once from lat/lng and returns region info (mocked external APIs)', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/trips',
        headers: { cookie },
        payload: {
          name: 'Lissabon-Region',
          start_date: '2026-02-01',
          end_date: '2026-02-05',
          lat: 38.7,
          lng: -9.1,
        },
      });
      const id = created.json().id;

      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url.includes('nominatim.openstreetmap.org')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ address: { country: 'Portugal', country_code: 'pt' } }),
            });
          }
          if (url.includes('restcountries.com')) {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve([
                  { languages: { por: 'Portuguese' }, currencies: { EUR: { name: 'Euro' } } },
                ]),
            });
          }
          if (url.includes('travel-advisory.info')) {
            return Promise.resolve({ ok: false, status: 503 });
          }
          return Promise.reject(new Error('unexpected URL in test: ' + url));
        })
      );

      const res = await app.inject({
        method: 'GET',
        url: `/api/trips/${id}/region-info`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        countryName: 'Portugal',
        languages: ['Portuguese'],
        currency: { code: 'EUR', name: 'Euro' },
        advisory: null,
      });
    });
  });
});
