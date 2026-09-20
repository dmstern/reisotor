import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Reproduziert den Schema-Stand VOR der Einführung von attachments.trip_id:
// Ältere attachments-Zeilen haben kein trip_id bzw. trip_id ist NULL.
// Die Migration in db/index.ts muss trip_id aus der jeweiligen entity_id nachziehen.
describe('attachments.trip_id Backfill-Migration', () => {
  let dbPath: string | undefined;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überträgt die trip_id aus verknüpften Entitäten auf bestehende attachments-Zeilen mit trip_id IS NULL', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-attachments-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL);
      CREATE TABLE notes (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL);
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL);
      CREATE TABLE schedule_items (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, date TEXT NOT NULL, title TEXT NOT NULL);
      CREATE TABLE budget_items (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, paid_by_user_id INTEGER NOT NULL);
      CREATE TABLE excursion_legs (id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, from_spot_id INTEGER NOT NULL, to_spot_id INTEGER NOT NULL);
      CREATE TABLE attachments (
        id INTEGER PRIMARY KEY,
        domain TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    legacy
      .prepare(
        `INSERT INTO users (id, username, email, password_hash, created_at) VALUES (1, 'alice', 'alice@test.de', 'hash', '2026-01-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (10, 'Trip 10', '2026-06-01', '2026-06-10')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (20, 'Trip 20', '2026-07-01', '2026-07-10')`
      )
      .run();

    legacy
      .prepare(`INSERT INTO spots (id, trip_id, title) VALUES (100, 10, 'Aussichtspunkt')`)
      .run();
    legacy
      .prepare(`INSERT INTO notes (id, trip_id, title, content) VALUES (200, 20, 'Notiz', 'Text')`)
      .run();
    legacy.prepare(`INSERT INTO ideas (id, trip_id, title) VALUES (300, 10, 'Tour 1')`).run();
    legacy
      .prepare(
        `INSERT INTO schedule_items (id, trip_id, date, title) VALUES (400, 20, '2026-07-02', 'Termin')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO budget_items (id, trip_id, title, amount, category, paid_by_user_id) VALUES (500, 10, 'Ausgabe', 50, 'Essen', 1)`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO excursion_legs (id, idea_id, from_spot_id, to_spot_id) VALUES (600, 300, 1, 2)`
      )
      .run();

    // Attachments ohne trip_id (altes Schema vor #412)
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (1, 'spots', 100, 'f1.jpg', 'f1.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (2, 'notes', 200, 'f2.jpg', 'f2.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (3, 'ideas', 300, 'f3.jpg', 'f3.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (4, 'schedule', 400, 'f4.jpg', 'f4.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (5, 'budget', 500, 'f5.jpg', 'f5.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at) VALUES (6, 'excursion_legs', 600, 'f6.jpg', 'f6.jpg', 'image/jpeg', 100, 1, '2026-06-01')`
      )
      .run();

    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const rows = db.prepare('SELECT id, trip_id FROM attachments ORDER BY id').all() as {
      id: number;
      trip_id: number;
    }[];
    expect(rows).toEqual([
      { id: 1, trip_id: 10 },
      { id: 2, trip_id: 20 },
      { id: 3, trip_id: 10 },
      { id: 4, trip_id: 20 },
      { id: 5, trip_id: 10 },
      { id: 6, trip_id: 10 },
    ]);
  });
});
