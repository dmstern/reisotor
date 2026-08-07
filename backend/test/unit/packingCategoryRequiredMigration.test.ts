import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// trips.packing_category_required ist additiv per ensureColumn(..., 'INTEGER NOT NULL DEFAULT 1')
// ergänzt (siehe db/index.ts) - kein Backfill nötig (reiner Default, kein Datenverlust), aber die
// gewünschte Semantik "bestehende Trips werden automatisch auf Pflicht gestellt" verdient einen Test
// gegen einen Schema-Stand von vor dieser Migration.
describe('trips.packing_category_required Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('backfills existing trips (created before this column existed) to packing_category_required = 1', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
    `);
    legacy.prepare(`INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Altreise', '2025-01-01', '2025-01-10')`).run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const trip = db.prepare('SELECT packing_category_required FROM trips WHERE id = 1').get() as {
      packing_category_required: number;
    };
    expect(trip.packing_category_required).toBe(1);
  });
});
