import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

describe('excursion_legs Migration & Backfill', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('erzeugt excursion_legs und migriert bestehende Touren mit Transport-Feldern', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-legs-migration-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    // Erstelle ein Schema ohne excursion_legs
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, avatar TEXT NOT NULL);
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT, category TEXT);
      CREATE TABLE budget_items (
        id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, category TEXT, amount REAL,
        paid_by_user_id INTEGER, date TEXT, note TEXT, budget_id INTEGER
      );
      CREATE TABLE ideas (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL,
        role TEXT, transport_type TEXT, departure_time TEXT, arrival_time TEXT,
        checkin_info TEXT, amount REAL, paid_by_user_id INTEGER, luggage TEXT,
        seat TEXT, ticket_link TEXT, budget_expense_id INTEGER
      );
      CREATE TABLE excursion_spots (
        id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, spot_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0
      );
    `);

    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Urlaub', '2026-08-01', '2026-08-10')`
      )
      .run();
    legacy.prepare(`INSERT INTO users (id, username, avatar) VALUES (1, 'test', '👤')`).run();
    legacy
      .prepare(
        `INSERT INTO spots (id, trip_id, title, category) VALUES (10, 1, 'Berlin Hbf', 'transport')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO spots (id, trip_id, title, category) VALUES (20, 1, 'Frankfurt Hbf', 'transport')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO budget_items (id, trip_id, title, category, amount, paid_by_user_id) VALUES (100, 1, 'Zugticket', 'Transport', 49.90, 1)`
      )
      .run();

    legacy
      .prepare(
        `
      INSERT INTO ideas (
        id, trip_id, title, role, transport_type, departure_time, arrival_time,
        checkin_info, amount, paid_by_user_id, luggage, seat, ticket_link, budget_expense_id
      ) VALUES (
        1, 1, 'Hinfahrt', 'arrival', 'Zug', '08:00', '12:00',
        'Gleis 7', 49.90, 1, '1 Koffer', 'Wagen 21 Platz 44', 'https://bahn.de', 100
      )
    `
      )
      .run();

    legacy
      .prepare(`INSERT INTO excursion_spots (id, idea_id, spot_id, position) VALUES (1, 1, 10, 0)`)
      .run();
    legacy
      .prepare(`INSERT INTO excursion_spots (id, idea_id, spot_id, position) VALUES (2, 1, 20, 1)`)
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db: migratedDb } = await import('../../src/db/index.js');

    const leg = migratedDb.prepare('SELECT * FROM excursion_legs WHERE idea_id = 1').get() as {
      position: number;
      from_spot_id: number;
      to_spot_id: number;
      transport_type: string;
      departure_time: string;
      arrival_time: string;
      checkin_info: string;
      seat: string;
      luggage: string;
      ticket_link: string;
      amount: number;
      paid_by_user_id: number;
      budget_expense_id: number;
    };

    expect(leg).toBeDefined();
    expect(leg.position).toBe(0);
    expect(leg.from_spot_id).toBe(10);
    expect(leg.to_spot_id).toBe(20);
    expect(leg.transport_type).toBe('Zug');
    expect(leg.departure_time).toBe('08:00');
    expect(leg.arrival_time).toBe('12:00');
    expect(leg.checkin_info).toBe('Gleis 7');
    expect(leg.seat).toBe('Wagen 21 Platz 44');
    expect(leg.luggage).toBe('1 Koffer');
    expect(leg.ticket_link).toBe('https://bahn.de');
    expect(leg.amount).toBe(49.9);
    expect(leg.paid_by_user_id).toBe(1);
    expect(leg.budget_expense_id).toBe(100);
  });
});
