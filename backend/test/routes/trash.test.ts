import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('trash (soft delete + restore)', () => {
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

  it('deleting a packing item hides it from the list and lists it in the trash', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, label: 'Regenjacke', quantity: 1 },
    });
    const id = created.json().id;

    const del = await app.inject({ method: 'DELETE', url: `/api/packing/${id}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);

    const list = await app.inject({ method: 'GET', url: `/api/packing?trip_id=${tripId}`, headers: { cookie } });
    expect(list.json().find((i: { id: number }) => i.id === id)).toBeUndefined();

    const trash = await app.inject({ method: 'GET', url: `/api/trash?trip_id=${tripId}`, headers: { cookie } });
    const entry = trash.json().find((e: { type: string; id: number }) => e.type === 'packing_item' && e.id === id);
    expect(entry).toBeDefined();
    expect(entry.data.label).toBe('Regenjacke');
  });

  it('restoring a soft-deleted item brings it back into the normal list and removes it from the trash', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie },
      payload: { trip_id: tripId, title: 'Reisepass einpacken' },
    });
    const id = created.json().id;
    await app.inject({ method: 'DELETE', url: `/api/todos/${id}`, headers: { cookie } });

    const restore = await app.inject({
      method: 'POST',
      url: `/api/trash/todo/${id}/restore`,
      headers: { cookie },
    });
    expect(restore.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: `/api/todos?trip_id=${tripId}`, headers: { cookie } });
    expect(list.json().find((i: { id: number }) => i.id === id)).toBeDefined();

    const trash = await app.inject({ method: 'GET', url: `/api/trash?trip_id=${tripId}`, headers: { cookie } });
    expect(trash.json().find((e: { type: string; id: number }) => e.type === 'todo' && e.id === id)).toBeUndefined();
  });

  it('deleting an excursion also soft-deletes its linked calendar entry, and restoring it restores both', async () => {
    const idea = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: { trip_id: tripId, title: 'Stadtrundgang', date: '2026-01-03' },
    });
    const ideaId = idea.json().id;

    const scheduleBefore = await app.inject({
      method: 'GET',
      url: `/api/schedule?trip_id=${tripId}`,
      headers: { cookie },
    });
    const linkedEntry = scheduleBefore.json().find((s: { idea_id: number | null }) => s.idea_id === ideaId);
    expect(linkedEntry).toBeDefined();

    const del = await app.inject({ method: 'DELETE', url: `/api/ideas/${ideaId}`, headers: { cookie } });
    expect(del.statusCode).toBe(204);

    const scheduleAfterDelete = await app.inject({
      method: 'GET',
      url: `/api/schedule?trip_id=${tripId}`,
      headers: { cookie },
    });
    expect(
      scheduleAfterDelete.json().find((s: { id: number }) => s.id === linkedEntry.id),
    ).toBeUndefined();

    const restore = await app.inject({
      method: 'POST',
      url: `/api/trash/excursion/${ideaId}/restore`,
      headers: { cookie },
    });
    expect(restore.statusCode).toBe(200);

    const scheduleAfterRestore = await app.inject({
      method: 'GET',
      url: `/api/schedule?trip_id=${tripId}`,
      headers: { cookie },
    });
    expect(
      scheduleAfterRestore.json().find((s: { id: number }) => s.id === linkedEntry.id),
    ).toBeDefined();
  });

  it('returns 400 for an unknown trash type on restore', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/trash/not-a-type/1/restore', headers: { cookie } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when restoring something that is not actually deleted', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/shopping',
      headers: { cookie },
      payload: { trip_id: tripId, label: 'Sonnencreme' },
    });
    const id = created.json().id;
    const res = await app.inject({
      method: 'POST',
      url: `/api/trash/shopping_item/${id}/restore`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
