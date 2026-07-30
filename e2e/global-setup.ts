import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '.tmp', 'e2e-backend.sqlite');
const fixturesPath = path.join(__dirname, 'fixtures', 'seeded-data.json');

// Läuft NACH den webServer-Einträgen (Playwright startet Plugins/webServer vor globalSetup) — die
// DB ist an diesem Punkt bereits fertig geseedet (Wipe+Seed passieren im backend-webServer-Befehl
// selbst, siehe playwright.config.ts, damit sie garantiert vor dem Serverstart laufen). Hier nur
// noch die Seed-Daten auslesen: sie enthalten Termine relativ zu "heute" (seedDemo.ts:
// startDate = heute+14) — direkt aus der DB lesen statt diese Datums-Mathematik in Spec-Dateien zu
// duplizieren (würde bei jedem Lauf drifted).
export default async function globalSetup() {
  fs.mkdirSync(path.dirname(fixturesPath), { recursive: true });

  const db = new Database(dbPath, { readonly: true });
  const trip = db.prepare('SELECT id, name, start_date, end_date FROM trips LIMIT 1').get() as {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
  };
  const scheduleItems = db
    .prepare(
      'SELECT date, time, title, note, location FROM schedule_items WHERE trip_id = ? ORDER BY date, time',
    )
    .all(trip.id);
  const ideas = db
    .prepare('SELECT title, date FROM ideas WHERE trip_id = ? ORDER BY date')
    .all(trip.id);
  db.close();

  fs.writeFileSync(fixturesPath, JSON.stringify({ trip, scheduleItems, ideas }, null, 2));
}
