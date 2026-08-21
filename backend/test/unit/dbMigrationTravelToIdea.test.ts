import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// #68/#176: Reise-Etappen (travel_items) werden vollständig durch Touren (ideas) mit
// role/transport_type/... abgelöst (siehe db/index.ts). Reproduziert den Schema-Stand VOR dieser
// Migration mit einer echten Reise-Etappe, die zwei freie Orte ohne Spot-Stammdaten referenziert
// (from_location/to_location, bewusst NICHT from_place_id/to_place_id - siehe Kommentar unten), ein
// gesetztes Datum (muss als Kalender-Termin nachgezogen werden) sowie eine verknüpfte Budget-Ausgabe
// (muss auf die Tour umgehängt, nicht dupliziert werden) und einen Datei-Anhang (muss auf die neue
// Tour-Id umgehängt werden). Am Ende muss travel_items selbst nicht mehr existieren.
//
// bewusst NICHT from_place_id/to_place_id: die (schon lange gemergte, aber additiv weiterhin per
// `CREATE TABLE IF NOT EXISTS` erzeugte) travel_places-Tabelle existiert auf einer frischen Test-DB
// immer, aber leer - die alte travel_places->spots-Remap-Migration (db/index.ts, "hasTable('travel_places')")
// würde dann jeden gesetzten from_place_id/to_place_id fälschlich auf NULL zurücksetzen (kein Eintrag
// in der leeren Remap-Tabelle), obwohl er hier schon direkt auf einen echten Spot zeigen soll - ein
// Zustand, der auf einer echten (längst migrierten) Prod-DB nicht vorkommt.
//
// Eigene Testdatei statt eines zweiten Tests in dbMigration.test.ts: ein zweiter
// `await import('../../src/db/index.js')` innerhalb derselben Datei träfe wegen Node's ESM-Modul-
// Cache auf die bereits beim ersten Test ausgeführte (und damit auf die falsche Test-DB zeigende)
// Modul-Instanz.
describe('travel_items -> ideas Vollmigration (#176)', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('spiegelt eine Reise-Etappe als Tour, zieht Kalender-Termin/Budget-Ausgabe/Anhang nach und droppt travel_items', async () => {
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
      CREATE TABLE budgets (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, name TEXT, kind TEXT, owner_id INTEGER);
      CREATE TABLE budget_items (id INTEGER PRIMARY KEY, trip_id INTEGER, budget_id INTEGER, title TEXT, category TEXT, amount REAL, paid_by_user_id INTEGER, date TEXT, note TEXT, deleted_at TEXT);
      CREATE TABLE attachments (id INTEGER PRIMARY KEY, domain TEXT NOT NULL, entity_id INTEGER NOT NULL, filename TEXT NOT NULL, original_name TEXT);
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
    legacy.prepare(`INSERT INTO users (id, username) VALUES (1, 'anna')`).run();
    legacy
      .prepare(`INSERT INTO budget_items (id, trip_id, title, category, amount, paid_by_user_id, date, note) VALUES (100, 1, 'Anreise mit dem Bus', 'Transport', 25.5, 1, '2026-08-04', 'Automatisch aus Reise-Eintrag')`)
      .run();
    legacy
      .prepare(
        `INSERT INTO travel_items (id, trip_id, title, type, role, date, departure_time, arrival_time, amount,
           paid_by_user_id, budget_expense_id, from_location, to_location, to_maps_link)
         VALUES (1, 1, 'Anreise mit dem Bus', 'bus', 'arrival', '2026-08-04', '08:00', '12:30', 25.5,
           1, 100, 'Zuhause', 'Flughafen Palma', 'https://maps.example/palma')`,
      )
      .run();
    legacy.prepare(`INSERT INTO attachments (id, domain, entity_id, filename, original_name) VALUES (500, 'travel', 1, 'ticket.pdf', 'Ticket.pdf')`).run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    // travel_items existiert nach der Migration nicht mehr.
    const travelTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'travel_items'")
      .all();
    expect(travelTable).toHaveLength(0);

    const idea = db
      .prepare(
        'SELECT id, title, role, transport_type, departure_time, arrival_time, amount, budget_expense_id FROM ideas WHERE title = ?',
      )
      .get('Anreise mit dem Bus') as {
      id: number;
      title: string;
      role: string;
      transport_type: string;
      departure_time: string;
      arrival_time: string;
      amount: number;
      budget_expense_id: number;
    };
    expect(idea).toMatchObject({
      title: 'Anreise mit dem Bus',
      role: 'arrival',
      transport_type: 'bus',
      departure_time: '08:00',
      arrival_time: '12:30',
      amount: 25.5,
    });

    // Stationen (Von/Nach) als Spots übernommen.
    const stations = db
      .prepare(
        `SELECT s.title FROM excursion_spots es JOIN spots s ON s.id = es.spot_id
         WHERE es.idea_id = ? ORDER BY es.position`,
      )
      .all(idea.id) as { title: string }[];
    expect(stations.map((s) => s.title)).toEqual(['Zuhause', 'Flughafen Palma']);

    // Kalender-Termin aus travel_items.date nachgezogen statt stillschweigend verloren zu gehen.
    const schedule = db.prepare('SELECT date, title FROM schedule_items WHERE idea_id = ?').get(idea.id) as
      | { date: string; title: string }
      | undefined;
    expect(schedule).toEqual({ date: '2026-08-04', title: 'Anreise mit dem Bus' });

    // Budget-Ausgabe umgehängt (dieselbe Zeile, id 100) statt dupliziert.
    expect(idea.budget_expense_id).toBe(100);
    const budgetItemCount = db.prepare('SELECT COUNT(*) c FROM budget_items').get() as { c: number };
    expect(budgetItemCount.c).toBe(1);

    // Anhang auf die neue Tour-Id umgehängt.
    const attachment = db.prepare('SELECT domain, entity_id FROM attachments WHERE id = 500').get() as
      | { domain: string; entity_id: number }
      | undefined;
    expect(attachment).toEqual({ domain: 'ideas', entity_id: idea.id });
  });
});
