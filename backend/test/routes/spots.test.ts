import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('spots route coordinate preservation', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('spottester', bcrypt.hashSync('correct-horse', 10), '🗺️');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'spottester', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Spot-Testreise', start_date: '2026-06-01', end_date: '2026-06-10' },
    });
    tripId = tripRes.json().id;
  });

  it('creates a spot with coordinates and preserves them on edit without maps_link', async () => {
    // 1. Create a spot with coordinates (e.g. from manual pin)
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Hotel Alfama',
        category: 'Unterkunft',
        lat: 38.72,
        lng: -9.12,
        address: 'Rua de São Pedro 12',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.lat).toBe(38.72);
    expect(created.lng).toBe(-9.12);

    // 2. Edit spot: change title/address, but DO NOT provide lat/lng/maps_link
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Hotel Alfama Renoviert',
        category: 'Unterkunft',
        address: 'Rua dos Caminhos de Ferro 40',
        // lat, lng, maps_link omitted/undefined!
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // 3. Verify coordinates were not wiped
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/spots?trip_id=${tripId}`,
      headers: { cookie },
    });
    const spots = getRes.json();
    const spot = spots.find((s: { id: number }) => s.id === created.id);
    expect(spot.title).toBe('Hotel Alfama Renoviert');
    expect(spot.address).toBe('Rua dos Caminhos de Ferro 40');
    expect(spot.lat).toBe(38.72);
    expect(spot.lng).toBe(-9.12);
  });

  it('allows explicitly clearing coordinates by passing null', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Spot mit Pin',
        category: 'Aussichtspunkt',
        lat: 38.71,
        lng: -9.13,
      },
    });
    const created = createRes.json();
    expect(created.lat).toBe(38.71);

    // Clear coordinates explicitly
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Spot ohne Pin',
        category: 'Aussichtspunkt',
        lat: null,
        lng: null,
      },
    });
    expect(updateRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/spots?trip_id=${tripId}`,
      headers: { cookie },
    });
    const spots = getRes.json();
    const spot = spots.find((s: { id: number }) => s.id === created.id);
    expect(spot.lat).toBeNull();
    expect(spot.lng).toBeNull();
  });
});
