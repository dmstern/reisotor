import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

// Reproduziert den Schema-Stand vor der Verschmelzung von accommodation in spots (siehe
// db/index.ts): eine Unterkunft mit echten Nutzdaten (Adresse, Zeitraum, Check-in/-out, Kontakt,
// Kosten, verknüpfte Budget-Ausgabe), eine Ausflug-Station, die bereits auf den (jetzt
// verschwindenden) accommodation-<id>-Schlüssel zeigt, sowie ein Datei-Anhang (Tickets/Dokumente),
// der bislang an domain='accommodation' + der alten accommodation.id hing. Die Migration muss all
// das verlustfrei in die neue, einheitliche Form (ein Spot der Kategorie "Unterkunft") übernehmen,
// statt es beim Tabellen-Drop stillschweigend zu verlieren.
describe('accommodation -> spots Verschmelzungs-Migration', () => {
  let dbPath: string | undefined;

  afterEach(() => {
    delete process.env.DB_PATH;
    if (dbPath) rmSync(path.dirname(dbPath), { recursive: true, force: true });
  });

  it('überführt Unterkunft, Ausflug-Stationen und Datei-Anhänge verlustfrei nach spots', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'reisotor-migration-test-'));
    dbPath = path.join(dir, 'legacy.sqlite');

    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL);
      CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, avatar TEXT NOT NULL);
      CREATE TABLE budget_items (
        id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL, category TEXT, amount REAL,
        paid_by_user_id INTEGER, date TEXT, note TEXT, budget_id INTEGER
      );
      CREATE TABLE accommodation (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, name TEXT NOT NULL, address TEXT,
        checkin TEXT, checkout TEXT, contact TEXT, note TEXT, lat REAL, lng REAL,
        start_date TEXT, end_date TEXT, maps_link TEXT, amount REAL, paid_by_user_id INTEGER,
        budget_expense_id INTEGER, deleted_at TEXT
      );
      CREATE TABLE spots (id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, title TEXT, image_url TEXT, category TEXT, note TEXT, maps_link TEXT, lat REAL, lng REAL, created_by INTEGER);
      CREATE TABLE ideas (id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT NOT NULL);
      CREATE TABLE excursion_spots (id INTEGER PRIMARY KEY, idea_id INTEGER NOT NULL, station_key TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE attachments (
        id INTEGER PRIMARY KEY, trip_id INTEGER NOT NULL, domain TEXT NOT NULL, entity_id INTEGER NOT NULL,
        filename TEXT NOT NULL, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL
      );
    `);
    legacy.prepare(`INSERT INTO trips (id, name, start_date, end_date) VALUES (1, 'Sommerurlaub', '2026-08-01', '2026-08-14')`).run();
    legacy.prepare(`INSERT INTO users (id, username, avatar) VALUES (1, 'anna', '🦊')`).run();
    legacy
      .prepare(
        `INSERT INTO budget_items (id, trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
         VALUES (50, 1, 'Hotel Meeresblick', 'Unterkunft', 540, 1, '2026-08-02', 'Automatisch aus Unterkunft-Eintrag', 1)`,
      )
      .run();
    legacy
      .prepare(
        `INSERT INTO accommodation (
           id, trip_id, name, address, checkin, checkout, contact, note, lat, lng,
           start_date, end_date, maps_link, amount, paid_by_user_id, budget_expense_id, deleted_at
         ) VALUES (
           7, 1, 'Hotel Meeresblick', 'Strandpromenade 1', '15:00', '11:00', '+49 123 456', 'Frühstück inklusive',
           40.8, 14.2, '2026-08-02', '2026-08-09', 'https://maps.example/hotel', 540, 1, 50, NULL
         )`,
      )
      .run();
    legacy.prepare(`INSERT INTO ideas (id, trip_id, title) VALUES (20, 1, 'Ankunftstag')`).run();
    legacy.prepare(`INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (20, 'accommodation-7', 0)`).run();
    legacy
      .prepare(
        `INSERT INTO attachments (id, trip_id, domain, entity_id, filename, original_name, mime_type, size_bytes, uploaded_by, created_at)
         VALUES (100, 1, 'accommodation', 7, 'abc.pdf', 'Buchungsbestaetigung.pdf', 'application/pdf', 1234, 1, '2026-07-01T00:00:00.000Z')`,
      )
      .run();
    legacy.close();

    process.env.DB_PATH = dbPath;
    const { db } = await import('../../src/db/index.js');

    // accommodation existiert nicht mehr.
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'accommodation'").all();
    expect(tables).toHaveLength(0);

    // Die Unterkunft ist jetzt ein ganz normaler Spot mit denselben Stammdaten.
    const spot = db.prepare('SELECT * FROM spots WHERE title = ?').get('Hotel Meeresblick') as
      | {
          id: number;
          trip_id: number;
          category: string;
          address: string;
          checkin: string;
          checkout: string;
          contact: string;
          note: string;
          lat: number;
          lng: number;
          start_date: string;
          end_date: string;
          maps_link: string;
          amount: number;
          paid_by_user_id: number;
          budget_expense_id: number;
          deleted_at: string | null;
        }
      | undefined;
    expect(spot).toBeDefined();
    expect(spot).toMatchObject({
      trip_id: 1,
      category: 'Unterkunft',
      address: 'Strandpromenade 1',
      checkin: '15:00',
      checkout: '11:00',
      contact: '+49 123 456',
      note: 'Frühstück inklusive',
      lat: 40.8,
      lng: 14.2,
      start_date: '2026-08-02',
      end_date: '2026-08-09',
      maps_link: 'https://maps.example/hotel',
      amount: 540,
      paid_by_user_id: 1,
      budget_expense_id: 50,
      deleted_at: null,
    });

    // Die Ausflug-Station zeigt jetzt direkt auf den Spot statt auf den verschwundenen
    // accommodation-Schlüssel (excursion_spots ist inzwischen selbst zu einer einfachen
    // idea_id<->spot_id-Verknüpfung migriert, siehe excursionSpotsMigration.test.ts).
    const station = db.prepare('SELECT spot_id FROM excursion_spots WHERE idea_id = 20').get() as
      | { spot_id: number }
      | undefined;
    expect(station?.spot_id).toBe(spot!.id);

    // Der Datei-Anhang verweist jetzt auf domain='spots' + die neue Spot-Id statt auf die
    // verschwundene accommodation-Domäne/-Id.
    const attachment = db.prepare('SELECT domain, entity_id FROM attachments WHERE id = 100').get() as
      | { domain: string; entity_id: number }
      | undefined;
    expect(attachment).toMatchObject({ domain: 'spots', entity_id: spot!.id });
  });
});
