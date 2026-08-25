import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für die Notification-Inbox (#97): trip_activity-Zeilen von ANDEREN Mitgliedern
// landen in der Liste (nicht die eigenen), sind zunächst ungelesen, und lassen sich einzeln bzw.
// komplett als gelesen markieren (notification_reads, siehe db/index.ts). Auth-/Mitgliedschafts-
// Gating folgt demselben requireTripMember()-Muster wie jede andere Urlaub-Route.
describe('notifications routes', () => {
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

  it('lists activity from other members as unread, excludes own activity, and supports marking read', async () => {
    const owner = await register('mira', 'mira@example.com');
    const member = await register('nils', 'nils@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Inbox-Trip', start_date: '2026-05-01', end_date: '2026-05-05' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    // Eigene Aktion des Owners soll NICHT in dessen eigener Inbox auftauchen.
    const ownTodo = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, title: 'Sonnencreme einpacken' },
    });
    expect(ownTodo.statusCode).toBe(201);

    // Fremde Aktion (member) soll in der Inbox des Owners auftauchen.
    const memberTodo = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: member.cookie },
      payload: { trip_id: tripId, title: 'Reisepass prüfen' },
    });
    const memberTodoId = memberTodo.json().id;

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/notifications?trip_id=${tripId}`,
      headers: { cookie: (await register('otto', 'otto@example.com')).cookie },
    });
    expect(forbidden.statusCode).toBe(403);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/notifications?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(listRes.statusCode).toBe(200);
    const notifications = listRes.json() as {
      id: number;
      domain: string;
      entity_id: number;
      action: string;
      read: boolean;
      actor: { username: string };
    }[];
    expect(notifications.every((n) => n.actor.username !== 'mira')).toBe(true);
    const created = notifications.find(
      (n) => n.entity_id === memberTodoId && n.action === 'created'
    );
    expect(created).toBeTruthy();
    expect(created!.read).toBe(false);

    const readRes = await app.inject({
      method: 'POST',
      url: `/api/notifications/${created!.id}/read`,
      headers: { cookie: owner.cookie },
    });
    expect(readRes.statusCode).toBe(204);

    const afterRead = await app.inject({
      method: 'GET',
      url: `/api/notifications?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(
      (afterRead.json() as { id: number; read: boolean }[]).find((n) => n.id === created!.id)?.read
    ).toBe(true);
  });

  it('POST /notifications/read-all marks every unread notification of the trip as read', async () => {
    const owner = await register('paula', 'paula@example.com');
    const member = await register('quentin', 'quentin@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Read-All-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: member.cookie },
      payload: { trip_id: tripId, title: 'Zelt reservieren' },
    });
    await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: member.cookie },
      payload: { trip_id: tripId, title: 'Karte laden' },
    });

    const readAll = await app.inject({
      method: 'POST',
      url: '/api/notifications/read-all',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId },
    });
    expect(readAll.statusCode).toBe(204);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/notifications?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    const notifications = listRes.json() as { read: boolean }[];
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.every((n) => n.read)).toBe(true);
  });

  it('liking/commenting on a diary entry creates a notification for other members', async () => {
    const owner = await register('rosa', 'rosa@example.com');
    const member = await register('sven', 'sven@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Diary-Trip', start_date: '2026-07-01', end_date: '2026-07-05' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    const entryRes = await app.inject({
      method: 'POST',
      url: '/api/diary',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, content: 'Toller Tag am Strand', date: '2026-07-02' },
    });
    const entryId = entryRes.json().id;

    await app.inject({
      method: 'POST',
      url: `/api/diary/${entryId}/like`,
      headers: { cookie: member.cookie },
    });
    await app.inject({
      method: 'POST',
      url: `/api/diary/${entryId}/comments`,
      headers: { cookie: member.cookie },
      payload: { content: 'Sieht super aus!' },
    });

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/notifications?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    const notifications = listRes.json() as { domain: string; entity_id: number; action: string }[];
    expect(notifications).toContainEqual(
      expect.objectContaining({ domain: 'diary', entity_id: entryId, action: 'liked' })
    );
    expect(notifications).toContainEqual(
      expect.objectContaining({ domain: 'diary', entity_id: entryId, action: 'commented' })
    );
  });
});
