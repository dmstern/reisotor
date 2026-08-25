import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für die Entwurfs-Zwischenspeicherung (routes/drafts.ts,
// frontend/src/composables/useDraftAutosave.ts): Auth-Gating, Upsert-Semantik und dass Entwürfe
// strikt pro Nutzer:in isoliert sind (nie über trip_members hinweg sichtbar).
describe('drafts routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
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

  it('PUT legt einen Entwurf an, GET liefert ihn zurück, ein zweiter PUT überschreibt ihn (Upsert)', async () => {
    const owner = await register('petra', 'petra@example.com');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Entwurf-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;

    const put1 = await app.inject({
      method: 'PUT',
      url: '/api/drafts',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        draft_key: 'notes:new',
        data: { title: '', content: 'Halbfertiger Text' },
      },
    });
    expect(put1.statusCode).toBe(200);

    const get1 = await app.inject({
      method: 'GET',
      url: `/api/drafts?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    const rows1 = get1.json() as { draft_key: string; data: { title: string; content: string } }[];
    expect(rows1).toEqual([
      {
        draft_key: 'notes:new',
        data: { title: '', content: 'Halbfertiger Text' },
        updated_at: expect.any(String),
      },
    ]);

    const put2 = await app.inject({
      method: 'PUT',
      url: '/api/drafts',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        draft_key: 'notes:new',
        data: { title: '', content: 'Weitergetippt' },
      },
    });
    expect(put2.statusCode).toBe(200);

    const get2 = await app.inject({
      method: 'GET',
      url: `/api/drafts?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    const rows2 = get2.json() as { draft_key: string; data: { content: string } }[];
    expect(rows2).toHaveLength(1);
    expect(rows2[0].data.content).toBe('Weitergetippt');
  });

  it('DELETE entfernt den Entwurf wieder', async () => {
    const owner = await register('quintus', 'quintus@example.com');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Entwurf-Lösch-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;

    await app.inject({
      method: 'PUT',
      url: '/api/drafts',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, draft_key: 'todos:new', data: { title: 'x' } },
    });
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/drafts?trip_id=${tripId}&draft_key=todos:new`,
      headers: { cookie: owner.cookie },
    });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({
      method: 'GET',
      url: `/api/drafts?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(get.json()).toEqual([]);
  });

  it('Entwürfe sind strikt pro Nutzer:in isoliert, auch innerhalb desselben Urlaubs', async () => {
    const owner = await register('rosalie', 'rosalie@example.com');
    const other = await register('simone', 'simone@example.com');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Geteilter-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: other.userId },
    });

    await app.inject({
      method: 'PUT',
      url: '/api/drafts',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        draft_key: 'notes:new',
        data: { content: 'Nur für owner sichtbar' },
      },
    });

    const getAsOther = await app.inject({
      method: 'GET',
      url: `/api/drafts?trip_id=${tripId}`,
      headers: { cookie: other.cookie },
    });
    expect(getAsOther.json()).toEqual([]);
  });

  it('lehnt Zugriff ohne Mitgliedschaft mit 403 ab', async () => {
    const owner = await register('tobias', 'tobias@example.com');
    const outsider = await register('ulla', 'ulla@example.com');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Fremder-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;

    const res = await app.inject({
      method: 'PUT',
      url: '/api/drafts',
      headers: { cookie: outsider.cookie },
      payload: { trip_id: tripId, draft_key: 'notes:new', data: {} },
    });
    expect(res.statusCode).toBe(403);
  });
});
