import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für die Standort-Aufzeichnung (routes/tracks.ts, stores/trackRecording.ts):
// Ownership-Gate (nur die aufzeichnende Person darf Punkte anhängen/stoppen/bearbeiten/löschen)
// und Sichtbarkeitsfilter (private Aufzeichnungen bleiben für andere Mitglieder unsichtbar, außer
// nach dem Umschalten auf 'shared') sind die beiden zentralen, leicht kaputtgehenden Regeln hier -
// reine CRUD-Pfade ohne Verzweigungslogik brauchen laut CLAUDE.md keinen eigenen Test.
describe('Standort-Aufzeichnung (/tracks)', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let ownerCookie: string;
  let memberCookie: string;
  let outsiderCookie: string;
  let tripId: number;

  async function login(username: string, password: string): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username, password } });
    const setCookie = res.headers['set-cookie'];
    return Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  }

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    for (const [username, avatar] of [
      ['track-owner', '🧭'],
      ['track-member', '🧑'],
      ['track-outsider', '🧟'],
    ] as const) {
      db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
        username,
        bcrypt.hashSync('correct-horse', 10),
        avatar,
      );
    }
    ownerCookie = await login('track-owner', 'correct-horse');
    memberCookie = await login('track-member', 'correct-horse');
    outsiderCookie = await login('track-outsider', 'correct-horse');

    const create = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: ownerCookie },
      payload: { name: 'Aufzeichnungs-Trip', start_date: '2030-01-01', end_date: '2030-01-10' },
    });
    tripId = create.json().id as number;

    const memberId = db.prepare('SELECT id FROM users WHERE username = ?').get('track-member') as { id: number };
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberId.id },
    });
  });

  afterAll(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('lehnt POST /tracks für Nicht-Mitglieder mit 403 ab', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: outsiderCookie },
      payload: { trip_id: tripId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('legt eine private Aufzeichnung an, die für Mitglieder unsichtbar bleibt', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId },
    });
    expect(create.statusCode).toBe(201);
    const track = create.json();
    expect(track.visibility).toBe('private');
    expect(track.user_id).toBeDefined();

    const ownerList = await app.inject({
      method: 'GET',
      url: `/api/tracks?trip_id=${tripId}`,
      headers: { cookie: ownerCookie },
    });
    expect(ownerList.json().map((t: { id: number }) => t.id)).toContain(track.id);

    const memberList = await app.inject({
      method: 'GET',
      url: `/api/tracks?trip_id=${tripId}`,
      headers: { cookie: memberCookie },
    });
    expect(memberList.json().map((t: { id: number }) => t.id)).not.toContain(track.id);
  });

  it('fremde Mitglieder können weder Punkte anhängen noch stoppen/bearbeiten/löschen', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId },
    });
    const trackId = create.json().id as number;

    const appendPoints = await app.inject({
      method: 'POST',
      url: `/api/tracks/${trackId}/points`,
      headers: { cookie: memberCookie },
      payload: { points: [{ lat: 48.2, lng: 16.37, recorded_at: new Date().toISOString() }] },
    });
    expect(appendPoints.statusCode).toBe(403);

    const stop = await app.inject({
      method: 'POST',
      url: `/api/tracks/${trackId}/stop`,
      headers: { cookie: memberCookie },
    });
    expect(stop.statusCode).toBe(403);

    const update = await app.inject({
      method: 'PUT',
      url: `/api/tracks/${trackId}`,
      headers: { cookie: memberCookie },
      payload: { visibility: 'shared' },
    });
    expect(update.statusCode).toBe(403);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/tracks/${trackId}`,
      headers: { cookie: memberCookie },
    });
    expect(del.statusCode).toBe(403);
  });

  it('Eigentümer:in kann Punkte anhängen, stoppen und danach abrufen', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId },
    });
    const trackId = create.json().id as number;

    const appendPoints = await app.inject({
      method: 'POST',
      url: `/api/tracks/${trackId}/points`,
      headers: { cookie: ownerCookie },
      payload: {
        points: [
          { lat: 48.2, lng: 16.37, recorded_at: '2030-01-02T10:00:00.000Z' },
          { lat: 48.21, lng: 16.38, recorded_at: '2030-01-02T10:00:10.000Z', accuracy: 5 },
        ],
      },
    });
    expect(appendPoints.statusCode).toBe(204);

    const stop = await app.inject({
      method: 'POST',
      url: `/api/tracks/${trackId}/stop`,
      headers: { cookie: ownerCookie },
    });
    expect(stop.statusCode).toBe(200);
    expect(stop.json().ended_at).toBeTruthy();

    const points = await app.inject({
      method: 'GET',
      url: `/api/tracks/${trackId}/points`,
      headers: { cookie: ownerCookie },
    });
    expect(points.json()).toHaveLength(2);
    expect(points.json()[0].lat).toBe(48.2);
  });

  it('macht eine Aufzeichnung nach dem Umschalten auf "shared" für andere Mitglieder sichtbar', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId },
    });
    const trackId = create.json().id as number;

    const beforeShare = await app.inject({
      method: 'GET',
      url: `/api/tracks/${trackId}/points`,
      headers: { cookie: memberCookie },
    });
    expect(beforeShare.statusCode).toBe(403);

    const share = await app.inject({
      method: 'PUT',
      url: `/api/tracks/${trackId}`,
      headers: { cookie: ownerCookie },
      payload: { visibility: 'shared' },
    });
    expect(share.json().visibility).toBe('shared');

    const memberList = await app.inject({
      method: 'GET',
      url: `/api/tracks?trip_id=${tripId}`,
      headers: { cookie: memberCookie },
    });
    expect(memberList.json().map((t: { id: number }) => t.id)).toContain(trackId);

    const afterShare = await app.inject({
      method: 'GET',
      url: `/api/tracks/${trackId}/points`,
      headers: { cookie: memberCookie },
    });
    expect(afterShare.statusCode).toBe(200);
  });

  it('löscht eine Aufzeichnung weich (Papierkorb) statt sie hart zu entfernen', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/tracks',
      headers: { cookie: ownerCookie },
      payload: { trip_id: tripId, visibility: 'shared' },
    });
    const trackId = create.json().id as number;

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/tracks/${trackId}`,
      headers: { cookie: ownerCookie },
    });
    expect(del.statusCode).toBe(204);

    const row = db.prepare('SELECT deleted_at FROM location_tracks WHERE id = ?').get(trackId) as {
      deleted_at: string | null;
    };
    expect(row.deleted_at).toBeTruthy();

    const list = await app.inject({
      method: 'GET',
      url: `/api/tracks?trip_id=${tripId}`,
      headers: { cookie: ownerCookie },
    });
    expect(list.json().map((t: { id: number }) => t.id)).not.toContain(trackId);

    const trash = await app.inject({
      method: 'GET',
      url: `/api/trash?trip_id=${tripId}`,
      headers: { cookie: ownerCookie },
    });
    const trashEntry = trash.json().find((e: { type: string; id: number }) => e.type === 'location_track' && e.id === trackId);
    expect(trashEntry).toBeDefined();

    const restore = await app.inject({
      method: 'POST',
      url: `/api/trash/location_track/${trackId}/restore`,
      headers: { cookie: ownerCookie },
    });
    expect(restore.statusCode).toBe(200);
  });
});
