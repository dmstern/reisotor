import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// Reproduziert den Schema-Stand vor der Umstellung von Touren auf eine echte spot_id-Fremdschlüssel-
// spalte (siehe db/index.ts): excursion_spots trug bisher einen generischen station_key statt einer
// echten spot_id. Reihenfolge (position) und Mehrfachbesuch (derselbe Ort z. B. als Start UND Ende
// eines Rundgangs) bleiben bewusst erhalten - zwei UI-Modi (einfaches Tagging vs. "Erweiterte
// Touren-Bearbeitung", siehe ProfileView.vue) teilen sich dasselbe Datenmodell. Die Migration muss:
// - 'spot-<id>'-Schlüssel direkt auf die Spot-Id abbilden, MEHRFACH vorkommende Stationen bleiben
//   als mehrere Zeilen (mit ihrer jeweiligen position) erhalten,
// - 'travel-from-<id>'/'travel-to-<id>'-Schlüssel über travel_items.from_place_id/to_place_id auf
//   die verknüpfte Spot-Id auflösen, sofern vorhanden,
// - eine Station ganz verwerfen, wenn sie sich nicht auf einen (noch existierenden) Spot auflösen
//   lässt (Freitext-Etappe ohne verknüpften Ort, bzw. ein längst gelöschter Spot) - der einzige
//   echte Funktionsverlust dieser Migration.
describe('excursion_spots spot_id-Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überführt station_key-Stationen verlustarm auf eine echte spot_id-Spalte, Reihenfolge/Mehrfachbesuch bleiben erhalten', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, avatar TEXT NOT NULL);
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT, image_url TEXT, category TEXT, note TEXT, maps_link TEXT, lat REAL, lng REAL, created_by INTEGER);
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL);
      CREATE TABLE travel_places (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, name TEXT NOT NULL, is_home INTEGER NOT NULL DEFAULT 0, type TEXT, maps_link TEXT, lat REAL, lng REAL);
      CREATE TABLE travel_items (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, from_place_id INTEGER, to_place_id INTEGER);
      CREATE TABLE excursion_spots (id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, station_key TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
    `);
    legacy.prepare(`INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`).run();
    legacy.prepare(`INSERT INTO users (id, username, avatar) VALUES (1, 'anna', '🦊')`).run();
    legacy.prepare(`INSERT INTO spots (id, trip_id, title) VALUES (5, 1, 'Torre de Belém')`).run();
    legacy.prepare(`INSERT INTO ideas (id, trip_id, title) VALUES (1, 1, 'Sightseeing-Tag')`).run();
    legacy.prepare(`INSERT INTO ideas (id, trip_id, title) VALUES (2, 1, 'Anreisetag')`).run();
    // Reise-Ort im alten (Vor-Phase-1) Schema - travel_items.from_place_id verweist noch auf
    // travel_places.id, nicht auf spots.id; wird von der travel_places-Migration (db/index.ts, läuft
    // VOR dieser hier) zu einem neuen Spot + umgeschriebenem from_place_id.
    legacy.prepare(`INSERT INTO travel_places (id, trip_id, name, is_home, type) VALUES (50, 1, 'Flughafen Lissabon', 0, 'Flughafen')`).run();
    // Etappe MIT verknüpftem Ort (from_place_id -> travel_places 50) und Etappe OHNE (to_place_id
    // NULL, reine Freitext-Ankunft).
    legacy
      .prepare(`INSERT INTO travel_items (id, trip_id, title, from_place_id, to_place_id) VALUES (9, 1, 'Hinflug', 50, NULL)`)
      .run();

    // idea 1: Spot 5 taucht ZWEIMAL auf (Rundgang, Start UND Ende) - muss als zwei Zeilen mit ihrer
    // jeweiligen position erhalten bleiben. Zusätzlich die Etappen-Abflugstation (travel-from-9 ->
    // Flughafen-Spot über from_place_id) dazwischen.
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (1, 'spot-5', 0)`).run();
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (1, 'travel-from-9', 1)`).run();
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (1, 'spot-5', 2)`).run();
    // idea 2: Ankunftsstation ohne verknüpften Ort (travel-to-9, to_place_id ist NULL) muss
    // ersatzlos wegfallen, ein Verweis auf einen längst gelöschten Spot ebenfalls.
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (2, 'travel-to-9', 0)`).run();
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (2, 'spot-999', 1)`).run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    // Neues Schema: keine station_key-Spalte mehr, dafür eine echte spot_id-Spalte - position bleibt.
    const columns = db.prepare('PRAGMA table_info(excursion_spots)').all() as { name: string }[];
    expect(columns.map((c) => c.name).sort()).toEqual(['id', 'idea_id', 'position', 'spot_id']);

    const airportSpot = db.prepare("SELECT id FROM spots WHERE title = 'Flughafen Lissabon'").get() as
      | { id: number }
      | undefined;
    expect(airportSpot).toBeDefined();

    // Reihenfolge UND Mehrfachbesuch (Spot 5 zweimal) bleiben erhalten, sortiert nach position.
    const idea1Rows = db
      .prepare('SELECT spot_id FROM excursion_spots WHERE idea_id = 1 ORDER BY position')
      .all() as { spot_id: number }[];
    expect(idea1Rows.map((r) => r.spot_id)).toEqual([5, airportSpot!.id, 5]);

    const idea2Rows = db.prepare('SELECT spot_id FROM excursion_spots WHERE idea_id = 2').all();
    expect(idea2Rows).toHaveLength(0);
  });
});
