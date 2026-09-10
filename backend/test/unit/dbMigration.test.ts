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
