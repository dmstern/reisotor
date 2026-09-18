import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('todos routes', () => {
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
      payload: { name: 'Testreise', start_date: '2026-09-01', end_date: '2026-09-10' },
    });
    tripId = tripRes.json().id;
  });

  it('creates a todo with coarse period and preserves period when toggling done', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Reisepass erneuern',
        period: 'before',
        priority: 'high',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.period).toBe('before');
    expect(created.done).toBe(0);

    // Toggle done to 1 while sending period
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/todos/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: created.title,
        period: created.period,
        priority: created.priority,
        done: true,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json();
    expect(updated.done).toBe(1);
    expect(updated.period).toBe('before');

    // Toggle done back to 0 while sending period
    const untoggleRes = await app.inject({
      method: 'PUT',
      url: `/api/todos/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: created.title,
        period: created.period,
        priority: created.priority,
        done: false,
      },
    });
    expect(untoggleRes.statusCode).toBe(200);
    const untoggled = untoggleRes.json();
    expect(untoggled.done).toBe(0);
    expect(untoggled.period).toBe('before');
  });

  it('allows updating or clearing the period when editing', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: 'Sonnencreme besorgen',
        period: 'before',
        priority: 'medium',
      },
    });
    const created = createRes.json();
    expect(created.period).toBe('before');

    // Update to during
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/todos/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: created.title,
        period: 'during',
        priority: created.priority,
        done: false,
      },
    });
    expect(updateRes.json().period).toBe('during');

    // Clear period (send undefined / null)
    const clearRes = await app.inject({
      method: 'PUT',
      url: `/api/todos/${created.id}`,
      headers: { cookie },
      payload: {
        trip_id: tripId,
        title: created.title,
        priority: created.priority,
        done: false,
      },
    });
    expect(clearRes.json().period).toBeNull();
  });
});
