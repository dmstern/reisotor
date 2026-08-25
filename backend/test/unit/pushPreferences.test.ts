import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// web-push würde ohne Mock echte Netzwerk-Requests an die (fiktive) Test-Endpoint-URL versuchen -
// gemockt wie fetch() in regionInfo.test.ts/mapsLink.test.ts, nur hier für die Push-Bibliothek
// selbst statt für einen HTTP-Aufruf innerhalb der zu testenden Funktion.
const sendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

describe('Push-Präferenzen filtern den Versand pro Domäne', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let ownerCookie: string;
  let memberCookie: string;
  let tripId: number;

  beforeAll(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public-key';
    process.env.VAPID_PRIVATE_KEY = 'test-private-key';
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'prefowner',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'prefmember',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );

    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'prefowner', password: 'correct-horse' },
    });
    ownerCookie = String(ownerLogin.headers['set-cookie']);
    const memberLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'prefmember', password: 'correct-horse' },
    });
    memberCookie = String(memberLogin.headers['set-cookie']);

    const createTrip = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: ownerCookie },
      payload: { name: 'Präferenz-Test-Trip', start_date: '2030-01-01', end_date: '2030-01-10' },
    });
    tripId = createTrip.json().id as number;

    const memberId = (
      db.prepare('SELECT id FROM users WHERE username = ?').get('prefmember') as { id: number }
    ).id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberId },
    });

    // Nur die Empfänger:in (das Mitglied) abonniert Push - der Owner löst die Aktivität selbst aus
    // und wird als Akteur ohnehin von notifyTripMembers() ausgeschlossen.
    await app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: { cookie: memberCookie },
      payload: {
        endpoint: 'https://push.example/member-endpoint',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
    });
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('sendet für eine unangetastete Domäne per Default (Zeile fehlt = aktiviert)', async () => {
    sendNotification.mockClear();
    await app.inject({
      method: 'POST',
      url: '/api/schedule',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, date: '2030-01-02', title: 'Ankunft' },
    });

    await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(1));
    const [subscription] = sendNotification.mock.calls[0] as [{ endpoint: string }];
    expect(subscription.endpoint).toBe('https://push.example/member-endpoint');
  });

  it('schließt eine per Präferenz deaktivierte Domäne vom Versand aus', async () => {
    const putPrefs = await app.inject({
      method: 'PUT',
      url: '/api/push/preferences',
      headers: { cookie: memberCookie },
      payload: { packing: false },
    });
    expect(putPrefs.json()).toMatchObject({ packing: false, schedule: true });

    sendNotification.mockClear();
    await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, category: 'Kleidung', label: 'Jacke' },
    });

    // Kurz warten, damit ein evtl. (fälschlich) angestoßener Versand Zeit hätte anzukommen -
    // vi.waitFor erwartet hier explizit, dass der Aufruf NICHT passiert, ein reines Poll-bis-true
    // würde das Gegenteil nicht verlässlich prüfen.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sendet nach Reaktivierung der Domäne wieder', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/push/preferences',
      headers: { cookie: memberCookie },
      payload: { packing: true },
    });

    sendNotification.mockClear();
    await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, category: 'Kleidung', label: 'Mütze' },
    });

    await vi.waitFor(() => expect(sendNotification).toHaveBeenCalledTimes(1));
  });

  it('GET /push/preferences liefert alle bekannten Domänen mit Default true, außer explizit gesetzten', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/push/preferences',
      headers: { cookie: memberCookie },
      payload: { budget: false },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/push/preferences',
      headers: { cookie: memberCookie },
    });
    const prefs = res.json();
    expect(prefs.budget).toBe(false);
    expect(prefs.schedule).toBe(true);
    expect(prefs.departure).toBe(true);
  });

  it('PUT /push/preferences lehnt unbekannte Domain-Keys ab', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/push/preferences',
      headers: { cookie: memberCookie },
      payload: { unicorns: false },
    });
    expect(res.statusCode).toBe(400);
  });
});
