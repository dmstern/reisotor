import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('POST /trips create_default_entries', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let cookie: string;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;

    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'defaultentryuser',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'defaultentryuser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  it('creates arrival, departure and home spot when create_default_entries is true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Toskana 2026',
        start_date: '2026-06-01',
        end_date: '2026-06-15',
        create_default_entries: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const trip = res.json();
    const tripId = trip.id;

    // Check ideas (tours)
    const ideas = db
      .prepare('SELECT title, role, note_format FROM ideas WHERE trip_id = ? ORDER BY id ASC')
      .all(tripId) as { title: string; role: string; note_format: string }[];

    expect(ideas).toHaveLength(2);
    expect(ideas[0]).toEqual({
      title: 'Anreise',
      role: 'arrival',
      note_format: 'html',
    });
    expect(ideas[1]).toEqual({
      title: 'Abreise',
      role: 'departure',
      note_format: 'html',
    });

    // Check schedule_items
    const scheduleItems = db
      .prepare('SELECT date, title FROM schedule_items WHERE trip_id = ? ORDER BY id ASC')
      .all(tripId) as { date: string; title: string }[];

    expect(scheduleItems).toHaveLength(2);
    expect(scheduleItems[0]).toEqual({
      date: '2026-06-01',
      title: 'Anreise',
    });
    expect(scheduleItems[1]).toEqual({
      date: '2026-06-15',
      title: 'Abreise',
    });

    // Check spots
    const spots = db
      .prepare('SELECT title, category, is_home, note_format FROM spots WHERE trip_id = ?')
      .all(tripId) as { title: string; category: string; is_home: number; note_format: string }[];

    expect(spots).toHaveLength(1);
    expect(spots[0]).toEqual({
      title: 'Zuhause',
      category: 'Zuhause',
      is_home: 1,
      note_format: 'html',
    });
  });

  it('does not create default entries when create_default_entries is omitted or false', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: {
        name: 'Leer 2026',
        start_date: '2026-07-01',
        end_date: '2026-07-10',
        create_default_entries: false,
      },
    });

    expect(res.statusCode).toBe(201);
    const trip = res.json();
    const tripId = trip.id;

    const ideas = db.prepare('SELECT * FROM ideas WHERE trip_id = ?').all(tripId);
    expect(ideas).toHaveLength(0);

    const spots = db.prepare('SELECT * FROM spots WHERE trip_id = ?').all(tripId);
    expect(spots).toHaveLength(0);
  });
});
