import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// trips.weather_model ist additiv per ensureColumn(..., "TEXT NOT NULL DEFAULT 'ecmwf_ifs025'")
// ergänzt (siehe db/index.ts) - kein Backfill nötig (reiner Default), aber die Semantik
// "bestehende Trips werden automatisch auf ecmwf_ifs025 gestellt" verdient einen Test
// gegen einen Schema-Stand von vor dieser Migration.
describe('trips.weather_model Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it("backfills existing trips to weather_model = 'ecmwf_ifs025'", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-weather-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT, end_date TEXT);
    `);
    legacy
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Altreise', '2025-01-01', '2025-01-10')`
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const trip = db.prepare('SELECT weather_model FROM trips WHERE id = 1').get() as {
      weather_model: string;
    };
    expect(trip.weather_model).toBe('ecmwf_ifs025');
  });
});
