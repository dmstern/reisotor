import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// content_format/note_format sind additiv per ensureColumn(..., "TEXT NOT NULL DEFAULT 'legacy'")
// ergänzt (siehe db/index.ts) - kein Backfill nötig (reiner Default, keine Bedeutungsverschiebung
// bestehender Werte), aber die gewünschte Semantik "bestehende Zeilen gelten als 'legacy' und
// rendern weiter über renderRichText()" verdient einen Test gegen einen Schema-Stand von vor dieser
// Migration.
describe('richtext content_format/note_format Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('backfills existing notes rows (created before this column existed) to "legacy"', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE notes (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT, content TEXT NOT NULL, created_by INTEGER, created_at TEXT NOT NULL);
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Altreise', '2025-01-01', '2025-01-10')`
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO notes (id, trip_id, title, content, created_by, created_at) VALUES (1, 1, 'Alt', '**fett**', 1, '2025-01-02')`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const note = db.prepare('SELECT content_format FROM notes WHERE id = 1').get() as {
      content_format: string;
    };
    expect(note.content_format).toBe('legacy');
  });
});
