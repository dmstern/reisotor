import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reproduziert den Schema-Stand einer bereits laufenden Prod-Instanz VOR der Migration, die
// ideas.date durch einen verknüpften schedule_items-Termin ersetzt (siehe db/index.ts): ein
// Ausflug mit gesetztem Datum, aber noch ohne Termin. Die Migration muss dafür einen Termin
// nachziehen, bevor die Spalte gelöscht wird - sonst geht das Datum echter Nutzerdaten beim
// Deploy stillschweigend verloren.
describe('ideas.date -> schedule_items Backfill-Migration', () => {
  let dbPath: string | undefined;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überträgt ein gesetztes ideas.date in einen schedule_items-Termin statt es beim Spalten-Drop zu verlieren', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, date TEXT);
      CREATE TABLE schedule_items (id INTEGER PRIMARY KEY, trip_id INTEGER, date TEXT NOT NULL, time TEXT, title TEXT NOT NULL, note TEXT, idea_id INTEGER);
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO ideas (id, trip_id, title, date) VALUES (1, 1, 'Bootstour', '2026-08-05')`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const ideaColumns = db.prepare('PRAGMA table_info(ideas)').all() as { name: string }[];
    expect(ideaColumns.some((c) => c.name === 'date')).toBe(false);

    const scheduleRow = db
      .prepare('SELECT trip_id, date, title, idea_id FROM schedule_items WHERE idea_id = 1')
      .get() as { trip_id: number; date: string; title: string; idea_id: number } | undefined;

    expect(scheduleRow).toEqual({ trip_id: 1, date: '2026-08-05', title: 'Bootstour', idea_id: 1 });
  });

  it('überträgt spots.done auf verknüpfte schedule_items bei der Migration', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-done-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE schedule_items (id INTEGER PRIMARY KEY, trip_id INTEGER, date TEXT NOT NULL, title TEXT NOT NULL, spot_id INTEGER);
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`
      )
      .run();
    legacy
      .prepare(`INSERT INTO spots (id, trip_id, title, done) VALUES (10, 1, 'Museum', 1)`)
      .run();
    legacy
      .prepare(
        `INSERT INTO schedule_items (id, trip_id, date, title, spot_id) VALUES (100, 1, '2026-08-03', 'Museum', 10)`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const scheduleRow = db.prepare('SELECT id, done FROM schedule_items WHERE id = 100').get() as
      { id: number; done: number } | undefined;

    expect(scheduleRow?.done).toBe(1);
  });
});

describe('ideas -> excursion_legs Transport-Backfill', () => {
  let dbPath: string | undefined;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überträgt Transport-Felder einer Tour auf einen neuen excursion_legs-Eintrag (Issue #361)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-legs-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password TEXT NOT NULL);
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE budget_items (id INTEGER PRIMARY KEY, trip_id INTEGER);
      CREATE TABLE ideas (
        id INTEGER PRIMARY KEY,
        trip_id INTEGER,
        title TEXT NOT NULL,
        role TEXT,
        transport_type TEXT,
        departure_time TEXT,
        arrival_time TEXT,
        checkin_info TEXT,
        seat TEXT,
        luggage TEXT,
        ticket_link TEXT,
        amount REAL,
        paid_by_user_id INTEGER,
        budget_expense_id INTEGER
      );
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL);
      CREATE TABLE excursion_spots (idea_id INTEGER, spot_id INTEGER, position INTEGER);
    `);

    legacy
      .prepare(`INSERT INTO users (id, email, password) VALUES (1, 'test@test.com', 'test')`)
      .run();
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Urlaub', '2026-08-01', '2026-08-14')`
      )
      .run();
    legacy.prepare(`INSERT INTO budget_items (id, trip_id) VALUES (99, 1)`).run();
    legacy
      .prepare(
        `
      INSERT INTO ideas (
        id, trip_id, title, role, transport_type, departure_time, arrival_time,
        checkin_info, seat, luggage, ticket_link, amount, paid_by_user_id, budget_expense_id
      ) VALUES (
        42, 1, 'Hinfahrt', 'arrival', 'Zug', '10:00', '14:00',
        'Gleis 9', 'Wagen 2 Platz 14', '1 Koffer', 'http://ticket', 49.90, 1, 99
      )
    `
      )
      .run();
    legacy
      .prepare(`INSERT INTO spots (id, trip_id, title) VALUES (10, 1, 'Start'), (11, 1, 'Ziel')`)
      .run();
    legacy
      .prepare(
        `INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (42, 10, 0), (42, 11, 1)`
      )
      .run();

    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const legRow = db.prepare('SELECT * FROM excursion_legs WHERE idea_id = 42').get() as Record<
      string,
      unknown
    >;

    expect(legRow).toBeDefined();
    expect(legRow.position).toBe(0);
    expect(legRow.from_spot_id).toBe(10);
    expect(legRow.to_spot_id).toBe(11);
    expect(legRow.transport_type).toBe('Zug');
    expect(legRow.departure_time).toBe('10:00');
    expect(legRow.arrival_time).toBe('14:00');
    expect(legRow.checkin_info).toBe('Gleis 9');
    expect(legRow.seat).toBe('Wagen 2 Platz 14');
    expect(legRow.luggage).toBe('1 Koffer');
    expect(legRow.ticket_link).toBe('http://ticket');
    expect(legRow.amount).toBe(49.9);
    expect(legRow.paid_by_user_id).toBe(1);
    expect(legRow.budget_expense_id).toBe(99);
  });
});

describe('trip_categories Schema-Initialisierung', () => {
  let dbPath: string | undefined;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('erstellt die Tabelle trip_categories mit Indizes', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-categories-test-'));
    dbPath = path.join(dir, 'test.sqlite');

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='trip_categories'")
      .all() as { name: string }[];
    expect(tables.length).toBe(1);

    const columns = db.prepare('PRAGMA table_info(trip_categories)').all() as {
      name: string;
      type: string;
    }[];
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('trip_id');
    expect(columnNames).toContain('type');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('icon');
    expect(columnNames).toContain('emoji');
    expect(columnNames).toContain('color');
    expect(columnNames).toContain('is_hidden');
  });
});

describe('location_tracks.end_reason Migration', () => {
  let dbPath: string | undefined;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('ergänzt die Spalte end_reason in einer bestehenden location_tracks Tabelle', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-tracks-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL);
      CREATE TABLE location_tracks (
        id INTEGER PRIMARY KEY,
        trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        excursion_id INTEGER,
        title TEXT,
        visibility TEXT NOT NULL DEFAULT 'private',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        deleted_at TEXT
      );
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Test-Trip', '2026-09-01', '2026-09-10')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO users (id, email, name, password) VALUES (1, 'test@example.com', 'Tester', 'secret')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO location_tracks (id, trip_id, user_id, started_at) VALUES (1, 1, 1, '2026-09-25T10:00:00Z')`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const columns = db.prepare('PRAGMA table_info(location_tracks)').all() as { name: string }[];
    expect(columns.some((c) => c.name === 'end_reason')).toBe(true);

    const row = db.prepare('SELECT id, end_reason FROM location_tracks WHERE id = 1').get() as {
      id: number;
      end_reason: string | null;
    };
    expect(row.end_reason).toBeNull();
  });
});
