import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('trips dates validation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
  });

  async function register(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { cookie, userId: res.json().id as number };
  }

  it('rejects POST /trips when start_date is after end_date', async () => {
    const user = await register('dateuser1', 'dateuser1@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: user.cookie },
      payload: {
        name: 'Ungültige Reise',
        start_date: '2026-09-10',
        end_date: '2026-09-05',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Das Enddatum darf nicht vor dem Startdatum liegen' });
  });

  it('allows POST /trips and rejects PUT /trips/:id when start_date is after end_date', async () => {
    const user = await register('dateuser2', 'dateuser2@example.com');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: user.cookie },
      payload: {
        name: 'Gültige Reise',
        start_date: '2026-09-01',
        end_date: '2026-09-10',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const tripId = createRes.json().id;

    const updateInvalidRes = await app.inject({
      method: 'PUT',
      url: `/api/trips/${tripId}`,
      headers: { cookie: user.cookie },
      payload: {
        name: 'Gültige Reise',
        start_date: '2026-09-15',
        end_date: '2026-09-10',
      },
    });

    expect(updateInvalidRes.statusCode).toBe(400);
    expect(updateInvalidRes.json()).toEqual({
      error: 'Das Enddatum darf nicht vor dem Startdatum liegen',
    });
  });
});
