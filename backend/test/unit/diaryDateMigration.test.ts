import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// diary_entries.date ist additiv per ensureColumn(..., 'TEXT') ergänzt (siehe db/index.ts) - anders
// als ein reiner DEFAULT-Wert braucht das einen echten Backfill: ohne ihn zeigten alle bestehenden
// Einträge dasselbe (falsche) Datum bzw. gar keins, statt weiterhin den Tag ihres created_at.
describe('diary_entries.date Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('backfills existing diary rows (created before this column existed) from created_at', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE diary_entries (id INTEGER PRIMARY KEY, trip_id INTEGER, author_id INTEGER NOT NULL, title TEXT, content TEXT NOT NULL, images TEXT, created_at TEXT NOT NULL, updated_at TEXT);
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Altreise', '2025-01-01', '2025-01-10')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO diary_entries (id, trip_id, author_id, title, content, created_at) VALUES (1, 1, 1, 'Alt', 'Hallo', '2025-01-03T18:42:00.000Z')`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const entry = db.prepare('SELECT date FROM diary_entries WHERE id = 1').get() as {
      date: string;
    };
    expect(entry.date).toBe('2025-01-03');
  });
});
