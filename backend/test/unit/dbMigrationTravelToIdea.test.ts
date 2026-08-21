import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// #68: Reise-Etappen (travel_items) werden als Grundlage für die Zusammenführung von Touren/Reisen
// zusätzlich als Tour (ideas) mit zwei Stationen (Von/Nach) gespiegelt (siehe db/index.ts). Reproduziert
// den Schema-Stand VOR dieser Migration (travel_items ohne migrated_idea_id) mit einer echten
// Reise-Etappe, die zwei freie Orte ohne Spot-Stammdaten referenziert (from_location/to_location) -
// bewusst NICHT from_place_id/to_place_id: die (schon lange gemergte, aber additiv weiterhin per
// `CREATE TABLE IF NOT EXISTS` erzeugte) travel_places-Tabelle existiert auf einer frischen Test-DB
// immer, aber leer - die alte travel_places->spots-Remap-Migration (db/index.ts, "hasTable('travel_places')")
// würde dann jeden gesetzten from_place_id/to_place_id fälschlich auf NULL zurücksetzen (kein Eintrag
// in der leeren Remap-Tabelle), obwohl er hier schon direkt auf einen echten Spot zeigen soll - ein
// Zustand, der auf einer echten (längst migrierten) Prod-DB nicht vorkommt. Eigene Testdatei statt
// eines zweiten Tests in dbMigration.test.ts: ein zweiter `await import('../../src/db/index.js')`
// innerhalb derselben Datei träfe wegen Node's ESM-Modul-Cache auf die bereits beim ersten Test
// ausgeführte (und damit auf die falsche Test-DB zeigende) Modul-Instanz.
describe('travel_items -> ideas/excursion_spots Spiegel-Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('spiegelt eine Reise-Etappe als Tour mit zwei Stationen und markiert sie als migriert', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL);
      CREATE TABLE spots (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT NOT NULL, image_url TEXT,
        category TEXT, note TEXT, maps_link TEXT, lat REAL, lng REAL, created_by INTEGER
      );
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, title TEXT NOT NULL, note TEXT, trip_id INTEGER, created_by INTEGER);
      CREATE TABLE excursion_spots (
        id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, spot_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE schedule_items (id INTEGER PRIMARY KEY, trip_id INTEGER, date TEXT NOT NULL, time TEXT, title TEXT NOT NULL, note TEXT, idea_id INTEGER);
      CREATE TABLE travel_items (
        id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, type TEXT,
        from_location TEXT, to_location TEXT, date TEXT, departure_time TEXT, arrival_time TEXT,
        checkin_info TEXT, amount REAL, paid_by_user_id INTEGER, luggage TEXT, seat TEXT, link TEXT,
        note TEXT, budget_expense_id INTEGER, from_maps_link TEXT, from_lat REAL, from_lng REAL,
        to_maps_link TEXT, to_lat REAL, to_lng REAL, role TEXT, from_place_id INTEGER, to_place_id INTEGER,
        deleted_at TEXT
      );
    `);
    legacy
      .prepare(`INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`)
      .run();
    legacy
      .prepare(
        `INSERT INTO travel_items (id, trip_id, title, type, role, departure_time, arrival_time, amount,
           from_location, to_location, to_maps_link)
         VALUES (1, 1, 'Anreise mit dem Bus', 'bus', 'arrival', '08:00', '12:30', 25.5, 'Zuhause', 'Flughafen Palma', 'https://maps.example/palma')`,
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    const travelRow = db.prepare('SELECT migrated_idea_id FROM travel_items WHERE id = 1').get() as {
      migrated_idea_id: number | null;
    };
    expect(travelRow.migrated_idea_id).not.toBeNull();

    const idea = db
      .prepare('SELECT title, role, transport_type, departure_time, arrival_time, amount FROM ideas WHERE id = ?')
      .get(travelRow.migrated_idea_id) as {
      title: string;
      role: string;
      transport_type: string;
      departure_time: string;
      arrival_time: string;
      amount: number;
    };
    expect(idea).toEqual({
      title: 'Anreise mit dem Bus',
      role: 'arrival',
      transport_type: 'bus',
      departure_time: '08:00',
      arrival_time: '12:30',
      amount: 25.5,
    });

    const stations = db
      .prepare(
        `SELECT s.title FROM excursion_spots es JOIN spots s ON s.id = es.spot_id
         WHERE es.idea_id = ? ORDER BY es.position`,
      )
      .all(travelRow.migrated_idea_id) as { title: string }[];
    expect(stations.map((s) => s.title)).toEqual(['Zuhause', 'Flughafen Palma']);
  });
});
