import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// Reproduziert den Schema-Stand vor der Verschmelzung von travel_places in spots (siehe
// db/index.ts): ein Reise-Ort ("Zuhause"), zwei Etappen, die ihn als Von/Nach referenzieren, sowie
// ein Ausflug, dessen Station bereits im vorherigen Batch auf den (jetzt verschwindenden)
// travel-place-<id>-Schlüssel zeigte. Die Migration muss echte Nutzdaten (Orts-Stammdaten,
// Von/Nach-Verknüpfungen, Stations-Referenzen) verlustfrei in die neue, einheitliche Form
// übernehmen, statt sie beim Tabellen-Drop stillschweigend zu verlieren.
describe('travel_places -> spots Verschmelzungs-Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überführt Orte, Etappen-Verknüpfungen und Stations-Schlüssel verlustfrei nach spots', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE travel_places (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, name TEXT NOT NULL,
        is_home INTEGER NOT NULL DEFAULT 0, type TEXT, maps_link TEXT, lat REAL, lng REAL
      );
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT, category TEXT, maps_link TEXT, lat REAL, lng REAL, created_by INTEGER);
      CREATE TABLE travel_items (
        id INTEGER PRIMARY KEY, title TEXT NOT NULL,
        from_place_id INTEGER REFERENCES travel_places(id), to_place_id INTEGER REFERENCES travel_places(id),
        trip_id INTEGER
      );
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL);
      CREATE TABLE excursion_spots (id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, station_key TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
    `);
    legacy
      .prepare(`INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`)
      .run();
    // Bestehender Reise-Ort mit echten Nutzdaten (Nutzer:innen-Stammdaten, die verlustfrei erhalten
    // bleiben müssen).
    legacy
      .prepare(
        `INSERT INTO travel_places (id, trip_id, name, is_home, type, maps_link, lat, lng)
         VALUES (5, 1, 'Zuhause', 1, 'Zuhause', 'https://maps.example/zuhause', 48.1, 11.5)`,
      )
      .run();
    // Etappe referenziert den Ort als Startpunkt (id 5) UND als "travel-place-5" in einer
    // Ausflug-Station (vorheriger Batch).
    legacy
      .prepare(
        `INSERT INTO travel_items (id, title, from_place_id, to_place_id, trip_id) VALUES (10, 'Hinflug', 5, NULL, 1)`,
      )
      .run();
    legacy.prepare(`INSERT INTO ideas (id, trip_id, title) VALUES (20, 1, 'Ankunftstag')`).run();
    legacy
      .prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (20, 'travel-place-5', 0)`)
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    // travel_places existiert nicht mehr.
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'travel_places'").all();
    expect(tables).toHaveLength(0);

    // Der Ort ist jetzt ein ganz normaler Spot mit denselben Stammdaten.
    const spot = db.prepare('SELECT * FROM spots WHERE title = ?').get('Zuhause') as
      | { id: number; trip_id: number; category: string; maps_link: string; lat: number; lng: number; is_home: number }
      | undefined;
    expect(spot).toBeDefined();
    expect(spot).toMatchObject({
      trip_id: 1,
      category: 'Zuhause',
      maps_link: 'https://maps.example/zuhause',
      lat: 48.1,
      lng: 11.5,
      is_home: 1,
    });

    // Die Etappe verweist jetzt auf die neue Spot-Id statt der (nicht mehr existierenden) Orts-Id -
    // UND behält ihre eigene ursprüngliche Id (id 10), da andere Referenzen (Budget, Anhänge,
    // Kalender) sich darauf verlassen.
    const travelItem = db.prepare('SELECT id, from_place_id, to_place_id FROM travel_items WHERE id = 10').get() as
      | { id: number; from_place_id: number; to_place_id: number | null }
      | undefined;
    expect(travelItem?.from_place_id).toBe(spot!.id);
    expect(travelItem?.to_place_id).toBeNull();

    // Die Ausflug-Station zeigt jetzt direkt auf den Spot statt auf den verschwundenen
    // travel-place-Schlüssel.
    const station = db.prepare('SELECT station_key FROM excursion_spots WHERE idea_id = 20').get() as
      | { station_key: string }
      | undefined;
    expect(station?.station_key).toBe(`spot-${spot!.id}`);
  });
});
