import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('packing routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

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

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Testreise', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    tripId = tripRes.json().id;
  });

  it('clamps packed_count down to quantity when creating an item (proves clampCounts is wired into the route)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, category: 'Hygiene', label: 'Zahnbürste', quantity: 2, packed_count: 5 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.quantity).toBe(2);
    expect(body.packed_count).toBe(2);
  });

  it('raises laid_out_count to at least packed_count on update', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, category: 'Sonstiges', label: 'Handtuch', quantity: 3 },
    });
    const id = created.json().id;

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/packing/${id}`,
      headers: { cookie },
      payload: { category: 'Sonstiges', label: 'Handtuch', quantity: 3, packed_count: 2, laid_out_count: 0 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().laid_out_count).toBe(2);
  });

  it('returns 404 when updating a non-existent item', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/packing/999999',
      headers: { cookie },
      payload: { label: 'Nichts', quantity: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 when deleting a non-existent item', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/packing/999999', headers: { cookie } });
    expect(res.statusCode).toBe(404);
  });
});
