import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

describe('trip_weather_snapshots lat/lng Backfill-Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('migriert trip_weather_snapshots auf das neue Schema mit lat/lng und erhält bestehende Einträge', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-weather-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, lat REAL, lng REAL);
      CREATE TABLE trip_weather_snapshots (
        id INTEGER PRIMARY KEY,
        trip_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        weathercode INTEGER NOT NULL,
        temp_max REAL NOT NULL,
        temp_min REAL NOT NULL,
        precipitation_probability REAL,
        UNIQUE(trip_id, date)
      );
    `);
    legacy
      .prepare(`INSERT INTO trips (id, name, start_date, end_date, lat, lng) VALUES (1, 'Lissabon', '2026-08-01', '2026-08-10', 38.72, -9.13)`)
      .run();
    legacy
      .prepare(`INSERT INTO trip_weather_snapshots (id, trip_id, date, weathercode, temp_max, temp_min, precipitation_probability) VALUES (1, 1, '2026-08-05', 0, 28, 18, 5)`)
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const cols = db.prepare('PRAGMA table_info(trip_weather_snapshots)').all() as { name: string }[];
    expect(cols.some((c) => c.name === 'lat')).toBe(true);
    expect(cols.some((c) => c.name === 'lng')).toBe(true);

    const snapshot = db
      .prepare('SELECT trip_id, lat, lng, date, temp_max FROM trip_weather_snapshots WHERE id = 1')
      .get() as { trip_id: number; lat: number; lng: number; date: string; temp_max: number };

    expect(snapshot).toEqual({ trip_id: 1, lat: 38.72, lng: -9.13, date: '2026-08-05', temp_max: 28 });
  });
});
