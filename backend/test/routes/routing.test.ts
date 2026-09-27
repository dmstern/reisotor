import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('routing routes (POST /api/trips/:tripId/routes/directions)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;

    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('routeuser', bcrypt.hashSync('secret-pass', 10), '🚗');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'routeuser', password: 'secret-pass' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Roadtrip Portugal', start_date: '2026-07-01', end_date: '2026-07-10' },
    });
    tripId = tripRes.json().id;
  });

  beforeEach(() => {
    process.env.ORS_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ORS_API_KEY;
  });

  it('verweigert unauthentifizierten Zugriff mit 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/routes/directions`,
      payload: {
        from_lat: 38.71,
        from_lng: -9.14,
        to_lat: 38.8,
        to_lng: -9.38,
        transport_type: 'Auto',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('validiert ungültige Koordinaten mit 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/routes/directions`,
      headers: { cookie },
      payload: {
        from_lat: 'invalid',
        from_lng: -9.14,
        to_lat: 38.8,
        to_lng: -9.38,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Start- und Zielkoordinaten müssen gültige Zahlen sein');
  });

  it('liefert Routen-Ergebnis bei gültigen Parametern', async () => {
    const mockOrs = {
      features: [
        {
          geometry: {
            coordinates: [
              [-9.14, 38.71],
              [-9.38, 38.8],
            ],
          },
          properties: {
            summary: {
              distance: 31200,
              duration: 1800,
            },
          },
        },
      ],
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockOrs,
    } as unknown as Response);

    const res = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/routes/directions`,
      headers: { cookie },
      payload: {
        from_lat: 38.71,
        from_lng: -9.14,
        to_lat: 38.8,
        to_lng: -9.38,
        transport_type: 'Auto',
      },
    });

    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json.supported).toBe(true);
    expect(json.routes).toHaveLength(1);
    expect(json.routes[0].distance_meters).toBe(31200);
    expect(json.routes[0].duration_seconds).toBe(1800);
    expect(json.routes[0].coordinates).toEqual([
      [38.71, -9.14],
      [38.8, -9.38],
    ]);
  });
});
