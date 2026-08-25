import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für PUT/GET /realtime/location-share (siehe stores/locationSharing.ts): Dauer
// wählbar (Tag/Woche/dauerhaft/aus), persistiert als Ablaufzeitpunkt in trip_members.
// location_share_until statt eines eigenen Enum-Werts (siehe Kommentar in db/index.ts).
describe('PUT/GET /realtime/location-share', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'shareuser',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'shareuser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Standort-Freigabe-Trip', start_date: '2030-01-01', end_date: '2030-01-10' },
    });
    tripId = create.json().id as number;
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('liefert location_share_until=null, solange nichts freigegeben wurde', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/realtime/location-share?trip_id=${tripId}`,
      headers: { cookie },
    });
    expect(res.json()).toEqual({ location_share_until: null });
  });

  it('setzt einen ca. 1 Tag in der Zukunft liegenden Ablaufzeitpunkt für duration=day', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/realtime/location-share',
      headers: { cookie },
      payload: { trip_id: tripId, duration: 'day' },
    });
    const until = res.json().location_share_until as string;
    const hoursAhead = (new Date(until).getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursAhead).toBeGreaterThan(23);
    expect(hoursAhead).toBeLessThan(25);

    const row = db
      .prepare('SELECT location_share_until FROM trip_members WHERE trip_id = ?')
      .get(tripId) as { location_share_until: string };
    expect(row.location_share_until).toBe(until);
  });

  it('duration=forever liegt weit (>1 Jahr) in der Zukunft', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/realtime/location-share',
      headers: { cookie },
      payload: { trip_id: tripId, duration: 'forever' },
    });
    const until = res.json().location_share_until as string;
    const daysAhead = (new Date(until).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysAhead).toBeGreaterThan(365);
  });

  it('duration=off setzt location_share_until wieder auf null', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/realtime/location-share',
      headers: { cookie },
      payload: { trip_id: tripId, duration: 'off' },
    });
    expect(res.json()).toEqual({ location_share_until: null });
  });

  it('lehnt eine ungültige duration mit 400 ab', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/realtime/location-share',
      headers: { cookie },
      payload: { trip_id: tripId, duration: 'jahrzehnt' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('lehnt einen Nicht-Mitglied-Zugriff mit 403 ab', async () => {
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'outsider',
      bcrypt.hashSync('correct-horse', 10),
      '🧟'
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'outsider', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    const outsiderCookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const res = await app.inject({
      method: 'PUT',
      url: '/api/realtime/location-share',
      headers: { cookie: outsiderCookie },
      payload: { trip_id: tripId, duration: 'day' },
    });
    expect(res.statusCode).toBe(403);
  });
});
