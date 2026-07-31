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
      payload: { name: 'Direkt', start_date: '2026-01-01', end_date: '2026-01-10', lat: 1.5, lng: 2.5 },
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
      payload: { name: 'Wird geleert', start_date: '2026-01-01', end_date: '2026-01-10', lat: 5, lng: 6 },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/trips/${id}`,
      headers: { cookie },
      payload: { name: 'Wird geleert', start_date: '2026-01-01', end_date: '2026-01-10', maps_link: '' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({ lat: null, lng: null });
  });

  it('returns 404 when updating a non-existent trip', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/trips/999999',
      headers: { cookie },
      payload: { name: 'x', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    expect(res.statusCode).toBe(404);
  });
});
