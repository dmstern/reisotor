import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { uploadsDir } from '../uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.join(__dirname, '..', '..', 'data.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


// Migration von der alten Singleton-Tabelle "trip" (immer nur eine Zeile mit id=1)
// zur neuen Liste "trips" (mehrere Urlaube möglich) – per RENAME bleiben alle
// bestehenden Daten und die ursprüngliche id erhalten.
const hasOldTripTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'trip'")
  .get();
if (hasOldTripTable) {
  db.exec('ALTER TABLE trip RENAME TO trips');
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  destination TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT,
  title TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS packing_items (
  id INTEGER PRIMARY KEY,
  category TEXT,
  label TEXT NOT NULL,
  checked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  note TEXT,
  status TEXT DEFAULT 'idea'
);

CREATE TABLE IF NOT EXISTS accommodation (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  checkin TEXT,
  checkout TEXT,
  contact TEXT,
  note TEXT,
  lat REAL,
  lng REAL
);

CREATE TABLE IF NOT EXISTS budget_items (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL,
  paid_by TEXT,
  is_paid INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_transfers (
  id INTEGER PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  date TEXT,
  note TEXT
);

-- Ein Budget ist entweder persönlich (owner_id gesetzt) oder geteilt (owner_id NULL). Es hat zwei
-- Modi: "einfach" über die weiter unten per ensureColumn ergänzte target_amount-Spalte (eine
-- direkte Gesamtsumme, keine Unterkategorien nötig) oder "detailliert" über budget_allocations
-- (Summe der Kategorie-Ziele ergibt die Gesamtsumme). Ist target_amount gesetzt, gewinnt es
-- gegenüber der Allokations-Summe (siehe frontend/src/utils/budgetTargets.ts).
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS budget_allocations (
  id INTEGER PRIMARY KEY,
  budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  UNIQUE(budget_id, category)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  assigned_to_user_id INTEGER REFERENCES users(id),
  checked INTEGER DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS todo_items (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to_user_id INTEGER REFERENCES users(id),
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  note TEXT,
  done INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS diary_entries (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT,
  content TEXT NOT NULL,
  images TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS diary_likes (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS diary_comments (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Zuordnung Tagebucheintrag <-> Ausflug (m:n): ein Eintrag kann z. B. mehrere an diesem Tag
-- unternommene Ausflüge referenzieren. idea_id, weil Ausflüge intern weiterhin in der
-- "ideas"-Tabelle liegen (siehe excursion_spots).
CREATE TABLE IF NOT EXISTS diary_excursions (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  UNIQUE(entry_id, idea_id)
);

-- Wer (neben der Haupt-Autorin, author_id auf diary_entries) einen Tagebucheintrag bereits bearbeitet
-- hat (#93: alle Mitreisenden dürfen bearbeiten, sollen dabei aber als Mit-Autor:innen erkennbar
-- bleiben). Ein UPSERT pro Bearbeitung aktualisiert nur edited_at, kein Verlauf einzelner Änderungen.
CREATE TABLE IF NOT EXISTS diary_entry_editors (
  entry_id INTEGER NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  edited_at TEXT NOT NULL,
  UNIQUE(entry_id, user_id)
);

CREATE TABLE IF NOT EXISTS idea_likes (
  id INTEGER PRIMARY KEY,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(idea_id, user_id)
);

CREATE TABLE IF NOT EXISTS idea_comments (
  id INTEGER PRIMARY KEY,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_likes (
  id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(note_id, user_id)
);

CREATE TABLE IF NOT EXISTS note_comments (
  id INTEGER PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- travel_items wird NICHT mehr hier angelegt (#176: vollständige Ablösung durch ideas mit
-- role/transport_type/... - siehe Migrationsblock weiter unten, der eine noch vorhandene
-- travel_items-Tabelle einmalig nach ideas überführt und danach droppt). Ein CREATE TABLE
-- IF NOT EXISTS an dieser Stelle würde auf einer DB, die die Tabelle bereits einmalig migriert
-- und gedroppt hat, bei jedem weiteren Neustart eine neue LEERE travel_items-Tabelle anlegen und
-- den folgenden Migrationsblock (gated über hasTable) fälschlich erneut auslösen (exakt derselbe
-- Bug, der zuvor schon travel_places betraf - siehe dortiger Kommentar-Rest).

CREATE TABLE IF NOT EXISTS spots (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  image_url TEXT,
  category TEXT,
  note TEXT,
  maps_link TEXT,
  lat REAL,
  lng REAL,
  created_by INTEGER REFERENCES users(id)
);

-- Verknüpfung Tour<->Spot: welche Spots gehören zu welcher Tour, in welcher Reihenfolge (Batch 13:
-- Reihenfolge/Mehrfachbesuche nachgerüstet; Batch 14: generischer station_key statt spot_id, damit
-- auch Unterkunft/Reise-Etappen-Enden ohne eigenen Spot als Station gehen). Seit Unterkunft/Reise-
-- Orte längst normale Spots sind (siehe Migrationskommentare weiter unten), ist eine Tour-Station
-- jetzt IMMER ein echter Spot – station_key wird daher wieder zur echten spot_id-Fremdschlüssel-
-- spalte. Reihenfolge (position) und Mehrfachbesuch (kein UNIQUE, ein Rundgang darf denselben Ort
-- z. B. als Start UND Ende enthalten) bleiben bewusst erhalten: zwei UI-Modi teilen sich dasselbe
-- Datenmodell – ein einfacher Tagging-Modus ("Tour zuordnen" im Spot-Formular, ohne Reihenfolge-
-- Pflege) und ein optionaler "Erweiterte Touren-Bearbeitung"-Modus (Einstellung in ProfileView.vue),
-- der weiterhin Drag&Drop-Reihenfolge + Mehrfachbesuch im Touren-Formular (SpotOrderPicker.vue)
-- anbietet. position bestimmt die Abklapper-Reihenfolge, nicht die Zeilen-Id.
CREATE TABLE IF NOT EXISTS excursion_spots (
  id INTEGER PRIMARY KEY,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0
);

-- Likes/Kommentare für Spots (analog idea_likes/idea_comments): ersetzt den bisherigen
-- Verworfen-Status – Spots werden per Like-Anzahl statt eines aktiv/verworfen-Flags sortiert.
CREATE TABLE IF NOT EXISTS spot_likes (
  id INTEGER PRIMARY KEY,
  spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(spot_id, user_id)
);

CREATE TABLE IF NOT EXISTS spot_comments (
  id INTEGER PRIMARY KEY,
  spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Persistenter Session-Store (sessionStore.ts) statt @fastify/session-Default (nur Arbeitsspeicher
-- – laut dessen eigener Dokumentation "should not be used in a production environment"): sonst
-- verliert jeder Nutzer seinen Login bei jedem Prozess-Neustart (Crash, Deploy, OOM auf dem Pi).
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER
);
`);

// Additive Migrationen (idempotent): erlaubt, das Schema weiterzuentwickeln,
// ohne bestehende Daten in data.sqlite zu verlieren. Läuft bei jedem Backend-Start automatisch
// gegen die echte Prod-Datei (deploy.sh/Pi-Cronjob überschreiben *.sqlite* nie) - das IST der
// Prod-Migrationsmechanismus, kein separater Schritt nötig.
//
// Vor jedem dropColumnIfExists/Rename einer Spalte, die schon vor dem letzten Prod-Deploy live war
// (Check: git diff gegen den Merge-Base mit origin/prod): Backfill davor, falls die Spalte echte
// Werte tragen könnte (siehe packing_items.checked bzw. ideas.date weiter unten als Vorlage) -
// sonst gehen sie beim nächsten Deploy kommentarlos verloren. Siehe CLAUDE.md, Abschnitt
// "Datenmodell-Änderungen (DB-Migrationen)", für den vollständigen Check.
function ensureColumn(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function dropColumnIfExists(table: string, column: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}

function hasColumn(table: string, column: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return existing.some((c) => c.name === column);
}

function hasTable(name: string) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

// Selbstregistrierung (Login-Seite) braucht eine E-Mail-Adresse zusätzlich zum Benutzernamen.
// Nullable statt UNIQUE NOT NULL: bestehende Nutzer:innen (vor Einführung der Registrierung
// angelegt) haben noch keine E-Mail; Eindeutigkeit wird wie beim bereits bestehenden `username`
// applikationsseitig per SELECT-Check vor dem INSERT geprüft (siehe routes/auth.ts) statt per
// SQL-Constraint, da SQLite eine UNIQUE-Spalte nicht nachträglich per ALTER TABLE ADD COLUMN
// ergänzen kann.
ensureColumn('users', 'email', 'TEXT');

// Mitgliedschaftskonzept pro Urlaub (Registrierung + Einladung): ein Urlaub ist nur noch für seine
// Mitglieder sichtbar/bearbeitbar (siehe tripAccess.ts, in praktisch jeder Urlaub-bezogenen Route
// verwendet) statt wie bisher implizit für alle Nutzer:innen. Backfill direkt hier bei der
// Einführung der Tabelle, nicht als dauerhafter Teil des Start-Skripts: alle zum
// Migrationszeitpunkt bestehenden Nutzer:innen werden einmalig Mitglied aller zu diesem Zeitpunkt
// bestehenden Urlaube, damit die schon aktiv nutzenden (echten) Nutzer:innen ihre bestehenden
// Urlaube nicht verlieren. Neu angelegte Urlaube bekommen danach nur noch die anlegende Person als
// Mitglied (routes/trips.ts), neu registrierte Nutzer:innen treten KEINEM bestehenden Urlaub
// automatisch bei – der Backfill läuft deshalb bewusst nur einmalig (gated auf "Tabelle existierte
// vorher noch nicht"), nicht bei jedem Backend-Start, sonst würde jede/r neu registrierte Person
// bei jedem Neustart rückwirkend allen bestehenden Urlauben beitreten.
const hadTripMembersTable = hasTable('trip_members');
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_members (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE(trip_id, user_id)
  );
`);
if (!hadTripMembersTable) {
  const allTripsForMembershipBackfill = db.prepare('SELECT id FROM trips').all() as { id: number }[];
  const allUsersForMembershipBackfill = db.prepare('SELECT id FROM users').all() as { id: number }[];
  const insertBackfillMembership = db.prepare(
    'INSERT OR IGNORE INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)',
  );
  const membershipBackfillNow = new Date().toISOString();
  for (const trip of allTripsForMembershipBackfill) {
    for (const user of allUsersForMembershipBackfill) {
      insertBackfillMembership.run(trip.id, user.id, membershipBackfillNow);
    }
  }
}

// Standort-Freigabe pro Mitgliedschaft: wählbare Dauer ("dauerhaft"/"1 Woche"/"1 Tag"), siehe
// routes/realtime.ts's location-share-Endpunkte. NULL = keine Freigabe (Default, entspricht dem
// bisherigen Verhalten: Broadcast nur solange TripMap.vue selbst gemountet ist). Ein Zeitstempel in
// der Zukunft aktiviert app-weites Teilen (auch außerhalb der Kartenansicht) bis zu diesem
// Zeitpunkt; "dauerhaft" wird als sehr weit in der Zukunft liegender Zeitstempel abgelegt statt
// eines eigenen Sonderwerts, damit ein einzelner Ablauf-Check (`location_share_until > now`)
// überall reicht.
ensureColumn('trip_members', 'location_share_until', 'TEXT');

ensureColumn('users', 'avatar', "TEXT DEFAULT '🙂'");
ensureColumn('ideas', 'lat', 'REAL');
ensureColumn('ideas', 'lng', 'REAL');
ensureColumn('ideas', 'maps_link', 'TEXT');
ensureColumn('packing_items', 'owner_id', 'INTEGER REFERENCES users(id)');
ensureColumn('schedule_items', 'idea_id', 'INTEGER REFERENCES ideas(id)');
ensureColumn('accommodation', 'start_date', 'TEXT');
ensureColumn('accommodation', 'end_date', 'TEXT');
ensureColumn('accommodation', 'maps_link', 'TEXT');
ensureColumn('budget_items', 'paid_by_user_id', 'INTEGER REFERENCES users(id)');
ensureColumn('budget_items', 'date', 'TEXT');
ensureColumn('budget_items', 'note', 'TEXT');
dropColumnIfExists('budget_items', 'paid_by');
dropColumnIfExists('budget_items', 'is_paid');
ensureColumn('shopping_items', 'link', 'TEXT');
ensureColumn('shopping_items', 'shop', 'TEXT');
ensureColumn('accommodation', 'amount', 'REAL');
ensureColumn('accommodation', 'paid_by_user_id', 'INTEGER REFERENCES users(id)');
ensureColumn('accommodation', 'budget_expense_id', 'INTEGER REFERENCES budget_items(id)');
// Buchungs-Link entfällt: Links gehören stattdessen ins Notizen-Feld (rendert sie automatisch,
// siehe utils/richText.ts), statt ein eigenes, oft mit dem Maps-Link verwechseltes Feld zu sein.
dropColumnIfExists('accommodation', 'link');
ensureColumn('schedule_items', 'end_date', 'TEXT');
ensureColumn('schedule_items', 'location', 'TEXT');
ensureColumn('schedule_items', 'maps_link', 'TEXT');
ensureColumn('schedule_items', 'lat', 'REAL');
ensureColumn('schedule_items', 'lng', 'REAL');
ensureColumn('schedule_items', 'category', "TEXT DEFAULT 'other'");
// Ein Termin kann statt (oder zusätzlich zu) einer Freitext-Adresse/Koordinate mit einem echten
// Spot oder einer Tour (ideas) verknüpft sein – siehe routes/schedule.ts. ON DELETE SET NULL statt
// CASCADE: der Termin bleibt als eigenständiges Kalender-Objekt bestehen, auch wenn der
// verknüpfte Spot später gelöscht wird (er verliert nur die Verknüpfung, nicht sich selbst).
ensureColumn('schedule_items', 'spot_id', 'INTEGER REFERENCES spots(id) ON DELETE SET NULL');
// Enduhrzeit zusätzlich zur Startuhrzeit (analog zu travel_items.arrival_time) – ein Termin kann
// damit einen echten Zeitraum statt nur eines Startpunkts abbilden.
ensureColumn('schedule_items', 'end_time', 'TEXT');
ensureColumn('trips', 'maps_link', 'TEXT');
ensureColumn('trips', 'lat', 'REAL');
ensureColumn('trips', 'lng', 'REAL');
ensureColumn('budget_items', 'budget_id', 'INTEGER REFERENCES budgets(id) ON DELETE SET NULL');
// Einfacher Budget-Modus: ein Budget kann statt/zusätzlich zu Kategorie-Allokationen
// (budget_allocations) direkt ein Gesamtziel tragen, ganz ohne Unterkategorien anzulegen. Rein
// additiv, nullable, keine Vorbedeutung zu migrieren (budgets-Tabelle war zwar schon vor diesem
// Commit live, aber ohne dieses Feld). Effektives Ziel eines Budgets, falls beides gesetzt ist:
// target_amount gewinnt (siehe frontend/src/utils/budgetTargets.ts für die Regel, konsistent für
// Gesamtbudget-KPI und Budget-Meter verwendet).
ensureColumn('budgets', 'target_amount', 'REAL');
ensureColumn('shopping_items', 'period', 'TEXT');
// ToDo-Einträge haben (anders als Einkaufslisten-Einträge) ein Fälligkeitsdatum – der Zeitraum
// (vor/während des Urlaubs) wird daraus + den Urlaubs-Eckdaten hergeleitet (utils/period.ts im
// Frontend) statt manuell gepflegt zu werden, daher entfällt die Spalte hier wieder.
dropColumnIfExists('todo_items', 'period');
ensureColumn('ideas', 'suggested_by_user_id', 'INTEGER REFERENCES users(id)');
// Packliste: Unterkategorien (z. B. "Outfit Tag 1" innerhalb "Kleidung"), eine Anzahl pro Gegenstand
// sowie zwei Packstufen (rausgelegt/eingepackt) statt eines einfachen Ja/Nein-Häkchens – beide Zähler
// sind pro Einheit gedacht und dürfen laid_out_count >= packed_count sein (etwas Eingepacktes war
// zwangsläufig vorher rausgelegt), siehe Klammerung in routes/packing.ts.
ensureColumn('packing_items', 'subcategory', 'TEXT');
ensureColumn('packing_items', 'quantity', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('packing_items', 'laid_out_count', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('packing_items', 'packed_count', 'INTEGER NOT NULL DEFAULT 0');
// Backfill + Ablösung des alten einfachen checked-Flags: bereits abgehakte Gegenstände gelten ab
// sofort als vollständig eingepackt (und damit auch rausgelegt), statt ihren Fortschritt beim
// Umstieg auf das neue Modell zu verlieren.
if (hasColumn('packing_items', 'checked')) {
  db.exec(
    `UPDATE packing_items SET packed_count = quantity, laid_out_count = quantity
     WHERE checked = 1 AND packed_count = 0`,
  );
  dropColumnIfExists('packing_items', 'checked');
}
ensureColumn('trips', 'image_url', 'TEXT');
// #176: travel_items' Spalten werden nicht mehr per ensureColumn gepflegt - die Tabelle wird nicht
// mehr neu angelegt (siehe Kommentar bei der entfernten CREATE TABLE weiter oben) und nie mehr
// beschrieben (routes/travel.ts entfällt). Eine auf einer bestehenden DB noch vorhandene
// travel_items-Tabelle trägt bereits alle Spalten aus früheren Deploys - der Migrationsblock weiter
// unten (`if (hasTable('travel_items'))`) liest sie nur noch einmalig aus und droppt sie danach.
// Ort-Art (Zuhause/Flughafen/Bahnhof/Busbahnhof/Hafen/Raststätte/Sonstiger Zwischenstopp) – rein
// fürs passende Icon in der Reise-Sicht UND den davon abgeleiteten Karten-/Spots-Einträgen (siehe
// utils/travelPlaceType.ts). Bewusst UNABHÄNGIG von is_home: is_home bleibt die alleinige Quelle
// dafür, ob ein Ort zur Heimat-Seite oder zur Urlaubsregion zählt (Rollen-Herleitung in
// applyPlaces() unten UND TripMap.vue's Urlaubsfokus/vacationPoints) – ein "Flughafen"-Ort kann
// z. B. sowohl der heimische Abflughafen (is_home) als auch der Zielflughafen (nicht is_home) sein,
// type allein könnte das nicht unterscheiden. Keine Migration/kein Backfill nötig, da neu und
// unabhängig von bestehenden Spalten (NULL = noch keine Art gewählt, Frontend zeigt dann den
// generischen Pin).
// Nur noch relevant auf einer (sehr alten) Prod-DB, die travel_places tatsächlich noch besitzt
// (siehe Bugfix-Kommentar bei `if (hasTable('travel_places'))` weiter unten) – auf jeder anderen DB
// existiert die Tabelle nicht (mehr), ensureColumn() würde dort sonst mit "no such table" scheitern.
if (hasTable('travel_places')) {
  ensureColumn('travel_places', 'type', 'TEXT');
}

// Ausflug ist ein reines Container-Objekt (Titel/Bild/Notiz/Spots) – "geplant"/"in Planung" ergibt
// sich nicht mehr aus einer eigenen Datums-Spalte, sondern daraus, ob ein Kalender-Termin
// (schedule_items) über idea_id auf diesen Ausflug verweist (routes/ideas.ts serialisiert das
// Datum dieses Termins zurück als Excursion.date, damit alle bestehenden Verbraucher davon
// unverändert weiterlaufen). Dasselbe gilt für einzelne Spots (schedule_items.spot_id) – beide
// Fälle legen dafür jetzt einen echten Termin an statt (wie zuvor) einen unsichtbaren
// Ein-Spot-Ausflug zu erzeugen. Backfill + Drop stehen weiter unten (nach dem trip_id-Block),
// weil der Backfill schedule_items.trip_id braucht, das erst dort sicher existiert.
ensureColumn('ideas', 'created_by', 'INTEGER REFERENCES users(id)');
dropColumnIfExists('ideas', 'link');
dropColumnIfExists('ideas', 'maps_link');
dropColumnIfExists('ideas', 'lat');
dropColumnIfExists('ideas', 'lng');
dropColumnIfExists('ideas', 'status');
dropColumnIfExists('ideas', 'suggested_by_user_id');

// Spot übernimmt die bisherige Rolle des alten "Ausflugs" (Ziel/Ort): "name" -> "title",
// zusätzlich Bild-URL und Ersteller. Additiv statt im CREATE TABLE, falls die Tabelle (z. B. in
// einer bereits laufenden Dev-Instanz) schon mit dem alten Schema angelegt wurde.
ensureColumn('spots', 'title', 'TEXT');
ensureColumn('spots', 'image_url', 'TEXT');
ensureColumn('spots', 'created_by', 'INTEGER REFERENCES users(id)');
// Heimat-Seite (unabhängig von der Kategorie – ein Flughafen kann sowohl der heimische Abflughafen
// als auch der Zielflughafen sein): übernimmt travel_places.is_home (siehe Migration weiter unten,
// nach dem trip_id-/deleted_at-Block), sobald Reise-Orte in Spots aufgehen. Für gewöhnliche Spots
// (Restaurant, Sehenswürdigkeit, …) bleibt es einfach 0, keine eigene UI-Bedeutung dort.
ensureColumn('spots', 'is_home', 'INTEGER NOT NULL DEFAULT 0');
// Unterkunft (accommodation) verschmilzt mit Spots (siehe Migration weiter unten, nach dem
// trip_id-/deleted_at-Block): ein Spot der Kategorie "Unterkunft" trägt zusätzlich Adresse/
// Zeitraum/Check-in-out/Kontakt/Kosten – bei gewöhnlichen Spots (Restaurant, Sehenswürdigkeit, …)
// bleiben diese Felder einfach leer, keine eigene UI-Bedeutung dort.
ensureColumn('spots', 'address', 'TEXT');
ensureColumn('spots', 'start_date', 'TEXT');
ensureColumn('spots', 'end_date', 'TEXT');
ensureColumn('spots', 'checkin', 'TEXT');
ensureColumn('spots', 'checkout', 'TEXT');
ensureColumn('spots', 'contact', 'TEXT');
ensureColumn('spots', 'amount', 'REAL');
ensureColumn('spots', 'paid_by_user_id', 'INTEGER REFERENCES users(id)');
ensureColumn('spots', 'budget_expense_id', 'INTEGER REFERENCES budget_items(id)');
// Verworfen-Status entfällt: Spots bekommen stattdessen Likes/Kommentare (spot_likes/
// spot_comments) und werden danach sortiert/gruppiert statt nach aktiv/verworfen.
dropColumnIfExists('spots', 'discarded');
if (hasColumn('spots', 'name')) {
  db.exec("UPDATE spots SET title = name WHERE title IS NULL");
  dropColumnIfExists('spots', 'name');
}
dropColumnIfExists('spots', 'link');

// trip_id auf allen Inhalts-Tabellen: ordnet jede Zeile einem Urlaub zu. ON DELETE CASCADE
// sorgt dafür, dass beim Löschen eines Urlaubs alle zugehörigen Daten mit verschwinden.
const TRIP_SCOPED_TABLES = [
  'schedule_items',
  'packing_items',
  'ideas',
  'budget_items',
  'budget_transfers',
  'shopping_items',
  'notes',
  'diary_entries',
] as const;

for (const table of TRIP_SCOPED_TABLES) {
  ensureColumn(table, 'trip_id', 'INTEGER REFERENCES trips(id) ON DELETE CASCADE');
}

// Backfill: bestehende Zeilen (aus der Zeit vor Multi-Urlaub-Unterstützung) dem
// jeweils ersten/ältesten Urlaub zuordnen, damit keine verwaisten Daten entstehen.
const firstTrip = db.prepare('SELECT id FROM trips ORDER BY id LIMIT 1').get() as { id: number } | undefined;
if (firstTrip) {
  for (const table of TRIP_SCOPED_TABLES) {
    db.prepare(`UPDATE ${table} SET trip_id = ? WHERE trip_id IS NULL`).run(firstTrip.id);
  }
}

// Backfill für den ideas.date-Drop weiter oben: Ausflüge, die noch ein Datum aus dem alten Modell
// tragen, bekommen dafür einen echten Termin, statt ihr Datum stillschweigend zu verlieren.
// Braucht ideas.trip_id/schedule_items.trip_id, deshalb erst hier (nach obigem Block) statt direkt
// bei den anderen ideas-Migrationen weiter oben.
if (hasColumn('ideas', 'date')) {
  db.exec(`
    INSERT INTO schedule_items (trip_id, date, title, idea_id)
    SELECT trip_id, date, title, id FROM ideas
    WHERE date IS NOT NULL AND date != ''
      AND NOT EXISTS (SELECT 1 FROM schedule_items WHERE idea_id = ideas.id)
  `);
  dropColumnIfExists('ideas', 'date');
}

const DEFAULT_BUDGET_CATEGORIES = [
  'Essen & Trinken',
  'Unterkunft',
  'Transport',
  'Aktivitäten & Spaß',
  'Souvenirs',
  'Sonstiges',
];

/** Legt für einen Urlaub das Standard-"Gemeinsame Budget" mit den Standardkategorien an,
 *  sofern noch kein geteiltes Budget existiert, und gibt dessen id zurück. */
export function ensureDefaultSharedBudget(tripId: number): number {
  const existing = db
    .prepare('SELECT id FROM budgets WHERE trip_id = ? AND owner_id IS NULL ORDER BY id LIMIT 1')
    .get(tripId) as { id: number } | undefined;
  const budgetId =
    existing?.id ??
    (db.prepare('INSERT INTO budgets (trip_id, name, owner_id) VALUES (?, ?, NULL)').run(tripId, 'Gemeinsames Budget')
      .lastInsertRowid as number);

  const insertAllocation = db.prepare(
    'INSERT OR IGNORE INTO budget_allocations (budget_id, category, amount) VALUES (?, ?, 0)',
  );
  for (const category of DEFAULT_BUDGET_CATEGORIES) {
    insertAllocation.run(budgetId, category);
  }
  return budgetId;
}

// Einmalige Migration vom alten Modell (ein manuell eingetragenes Gesamtbudget, optionale
// Pro-Nutzer-Ziele, trip-weite Kategorie-Ziele) zum neuen Budget-Modell (mehrere Budgets,
// persönlich oder geteilt, jeweils in Kategorien aufgeteilt – die Gesamtsumme ergibt sich
// automatisch aus der Summe aller Kategorien aller Budgets). Bestehende Zahlen bleiben erhalten.
if (hasTable('budget_targets')) {
  const migrateBudgets = db.transaction(() => {
    const targets = db.prepare('SELECT * FROM budget_targets').all() as {
      trip_id: number;
      owner_id: number | null;
      amount: number;
    }[];
    const categoryTargets = hasTable('budget_category_targets')
      ? (db.prepare('SELECT * FROM budget_category_targets').all() as {
          trip_id: number;
          category: string;
          amount: number;
        }[])
      : [];

    const insertBudget = db.prepare('INSERT INTO budgets (trip_id, name, owner_id) VALUES (?, ?, ?)');
    // upsert statt plain insert: "Sonstiges" kann sowohl aus den alten Kategorie-Zielen als auch
    // aus dem Rundungs-/Rest-Betrag stammen – beide Werte müssen sich addieren statt zu kollidieren.
    const insertAllocation = db.prepare(
      `INSERT INTO budget_allocations (budget_id, category, amount) VALUES (?, ?, ?)
       ON CONFLICT(budget_id, category) DO UPDATE SET amount = amount + excluded.amount`,
    );
    const usernameOf = (id: number) =>
      (db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string } | undefined)
        ?.username ?? `Nutzer ${id}`;

    for (const target of targets) {
      if (target.owner_id === null) {
        // Geteiltes Ziel: alte trip-weite Kategorie-Ziele werden zu Kategorien dieses Budgets;
        // eine Differenz zum ehemals manuell eingetragenen Gesamtbetrag landet in "Sonstiges",
        // damit der Zahlenwert nicht verloren geht.
        const budgetId = insertBudget.run(target.trip_id, 'Gemeinsames Budget', null).lastInsertRowid as number;
        const tripCategoryTargets = categoryTargets.filter((c) => c.trip_id === target.trip_id);
        for (const c of tripCategoryTargets) {
          insertAllocation.run(budgetId, c.category, c.amount);
        }
        const allocatedSum = tripCategoryTargets.reduce((s, c) => s + c.amount, 0);
        const remainder = target.amount - allocatedSum;
        if (remainder > 0) {
          insertAllocation.run(budgetId, 'Sonstiges', remainder);
        }
      } else if (target.amount > 0) {
        const budgetId = insertBudget.run(
          target.trip_id,
          `Persönliches Budget (${usernameOf(target.owner_id)})`,
          target.owner_id,
        ).lastInsertRowid as number;
        insertAllocation.run(budgetId, 'Sonstiges', target.amount);
      }
    }

    db.exec('DROP TABLE IF EXISTS budget_targets');
    db.exec('DROP TABLE IF EXISTS budget_category_targets');
  });
  migrateBudgets();
}

// Für jeden Urlaub sicherstellen, dass ein geteiltes Budget mit den Standardkategorien existiert
// (frisch angelegte Urlaube sowie ggf. eben migrierte Urlaube ohne geteiltes Ziel).
const allTrips = db.prepare('SELECT id FROM trips').all() as { id: number }[];
const sharedBudgetIdByTrip = new Map<number, number>();
for (const trip of allTrips) {
  sharedBudgetIdByTrip.set(trip.id, ensureDefaultSharedBudget(trip.id));
}

// Bugfix-Backfill (Batch 11): Vor diesem Fix wurden automatisch aus Unterkunft-/Reise-Einträgen
// erzeugte Ausgaben ohne budget_id angelegt und nur über den zufällig gleichen Kategorienamen in
// der Kategorien-Visualisierung "erraten" – das brach z. B. sobald ein zweites geteiltes Budget
// existierte. Bereits bestehende Alt-Zeilen werden hier einmalig nachträglich verknüpft.
const orphanedAutoExpenses = db
  .prepare("SELECT id, trip_id FROM budget_items WHERE budget_id IS NULL AND note LIKE 'Automatisch%'")
  .all() as { id: number; trip_id: number }[];
const linkAutoExpense = db.prepare('UPDATE budget_items SET budget_id = ? WHERE id = ?');
for (const row of orphanedAutoExpenses) {
  const budgetId = sharedBudgetIdByTrip.get(row.trip_id);
  if (budgetId) linkAutoExpense.run(budgetId, row.id);
}

// Datei-Anhänge (Tickets/Dokumente, siehe routes/attachments.ts): polymorphe Referenz analog zu
// trip_activity weiter unten – entity_id hat bewusst KEINEN FK, da die Zieltabelle je nach domain
// variiert (schedule_items/accommodation/notes/travel_items/budget_items), SQLite kennt keinen FK
// auf eine von mehreren möglichen Tabellen. Muss VOR purgeOldTrash() unten existieren, da dessen
// Aufräum-Logik bereits auf diese Tabelle zugreift (siehe purgeAttachmentsForEntities).
db.exec(`
  CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_attachments_domain_entity ON attachments (domain, entity_id)');

/** Löscht Anhang-Zeilen + zugehörige Dateien auf der Platte für eine Menge von Objekt-ids einer
 *  Attachment-Domäne (siehe routes/attachments.ts's DOMAIN_TABLE) – aufgerufen, bevor die
 *  referenzierenden Zeilen selbst endgültig verschwinden (Papierkorb-Purge unten, Urlaub-Löschung
 *  in routes/trips.ts), sonst blieben verwaiste Dateien dauerhaft auf der Platte liegen. */
export function purgeAttachmentsForEntities(domain: string, entityIds: number[]) {
  if (!entityIds.length) return;
  const placeholders = entityIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT filename FROM attachments WHERE domain = ? AND entity_id IN (${placeholders})`)
    .all(domain, ...entityIds) as { filename: string }[];
  db.prepare(`DELETE FROM attachments WHERE domain = ? AND entity_id IN (${placeholders})`).run(domain, ...entityIds);
  for (const row of rows) {
    try {
      fs.unlinkSync(path.join(uploadsDir, row.filename));
    } catch {
      // Datei schon weg (oder nie erfolgreich geschrieben) – kein Fehlerfall.
    }
  }
}

// Weicher Löschvorgang (Papierkorb, routes/trash.ts): Löschen setzt nur noch deleted_at statt die
// Zeile per DELETE zu entfernen, damit sie sich wiederherstellen lässt. Gilt für alle Objekttypen,
// die der Nutzer selbst aktiv anlegt/löscht (nicht für reine Zuordnungstabellen wie
// excursion_spots/likes/comments oder Referenzdaten wie travel_places/budgets).
export const TRASH_TABLES = [
  'schedule_items',
  'ideas',
  'spots',
  'budget_items',
  'budget_transfers',
  'todo_items',
  'packing_items',
  'shopping_items',
  'notes',
  'diary_entries',
] as const;

for (const table of TRASH_TABLES) {
  ensureColumn(table, 'deleted_at', 'TEXT');
}

// Reise-Orte (travel_places) verschmelzen mit Spots: statt einer eigenen, parallelen Orte-Liste nur
// für Reise-Etappen ist ein "Ort" (Flughafen/Bahnhof/Zuhause/…) jetzt einfach ein ganz normaler Spot
// mit passender Kategorie – er lässt sich direkt in der Spots-Sicht anlegen und erscheint dort auch
// automatisch, sobald er als Von/Nach einer Etappe gewählt wird ("eingebettet", keine zweite
// Darstellung mehr nötig). is_home (siehe ensureColumn('spots', 'is_home', …) oben) bleibt dabei
// unabhängig von der Kategorie erhalten – ein Flughafen kann sowohl der heimische Abflughafen als
// auch der Zielflughafen sein.
//
// Muss NACH den beiden Schleifen oben laufen: die travel_items-Tabelle wird komplett neu angelegt
// (siehe unten) und muss dafür bereits ihre trip_id-/deleted_at-Spalten besitzen, die erst durch die
// TRIP_SCOPED_TABLES-/TRASH_TABLES-Schleifen ergänzt werden – sonst schlägt der Neuaufbau auf einer
// frischen/Test-DB mit "no such column" fehl (siehe CLAUDE.md, Migrations-Reihenfolge).
//
// Bugfix (#68-Vorarbeit): travel_places wurde bis eben zusätzlich unconditional per
// `CREATE TABLE IF NOT EXISTS` im Basis-Schema weiter oben angelegt – dieser Block hier löscht die
// Tabelle am Ende aber wieder (`DROP TABLE travel_places`). In Kombination bedeutete das: JEDER
// Backend-Neustart legte travel_places leer neu an, hasTable() war dadurch dauerhaft wahr, und dieser
// komplette Block lief bei JEDEM Neustart erneut – mit einer LEEREN placeToSpotId-Map, die jedes
// gesetzte travel_items.from_place_id/to_place_id stillschweigend auf NULL zurücksetzte (echter
// Datenverlust auf Prod bei jedem Deploy/Neustart). Die `CREATE TABLE IF NOT EXISTS travel_places`-
// Zeile ist jetzt entfernt – dieser Block läuft dadurch nur noch echt einmalig, nämlich auf einer
// (sehr alten) Prod-DB, die travel_places tatsächlich noch mit echten Alt-Daten besitzt.
if (hasTable('travel_places')) {
  interface LegacyTravelPlaceRow {
    id: number;
    trip_id: number;
    name: string;
    is_home: number;
    type: string | null;
    maps_link: string | null;
    lat: number | null;
    lng: number | null;
  }
  const places = db.prepare('SELECT * FROM travel_places').all() as LegacyTravelPlaceRow[];
  const placeToSpotId = new Map<number, number>();
  const insertSpot = db.prepare(
    `INSERT INTO spots (trip_id, title, category, maps_link, lat, lng, is_home) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const p of places) {
    const result = insertSpot.run(p.trip_id, p.name, p.type, p.maps_link, p.lat, p.lng, p.is_home);
    placeToSpotId.set(p.id, result.lastInsertRowid as number);
  }

  // travel_items.from_place_id/to_place_id verweisen per FK fest auf travel_places(id) (foreign_keys
  // ist oben per PRAGMA aktiviert) – SQLite erlaubt kein nachträgliches Ändern des FK-Ziels einer
  // bestehenden Spalte, daher das Standard-SQLite-Muster fürs Ändern einer Spalten-FK: Tabelle
  // komplett neu anlegen (mit from_place_id/to_place_id REFERENCES spots(id)) und alle Zeilen mit
  // umgeschriebenen Von/Nach-Ids (alte travel_places.id -> neue spots.id, siehe placeToSpotId oben)
  // hinüberkopieren. id wird dabei explizit mit übernommen (nicht neu vergeben) – sonst bräche jede
  // bestehende Referenz auf einen Reise-Eintrag (budget_expense_id-Rückverweis, Attachments,
  // excursion_spots' 'travel-from-<id>'/'travel-to-<id>'-Stationsschlüssel, Kalender-Verknüpfungen).
  db.exec('ALTER TABLE travel_items RENAME TO travel_items_migrating');
  db.exec(`
    CREATE TABLE travel_items (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT,
      from_location TEXT,
      to_location TEXT,
      date TEXT,
      departure_time TEXT,
      checkin_info TEXT,
      amount REAL,
      paid_by_user_id INTEGER REFERENCES users(id),
      luggage TEXT,
      seat TEXT,
      link TEXT,
      note TEXT,
      budget_expense_id INTEGER REFERENCES budget_items(id),
      from_maps_link TEXT,
      from_lat REAL,
      from_lng REAL,
      to_maps_link TEXT,
      to_lat REAL,
      to_lng REAL,
      role TEXT,
      arrival_time TEXT,
      from_place_id INTEGER REFERENCES spots(id) ON DELETE SET NULL,
      to_place_id INTEGER REFERENCES spots(id) ON DELETE SET NULL,
      trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
      deleted_at TEXT
    )
  `);
  const oldItems = db.prepare('SELECT * FROM travel_items_migrating').all() as Record<string, unknown>[];
  const insertItem = db.prepare(`
    INSERT INTO travel_items (
      id, title, type, from_location, to_location, date, departure_time, checkin_info, amount,
      paid_by_user_id, luggage, seat, link, note, budget_expense_id, from_maps_link, from_lat, from_lng,
      to_maps_link, to_lat, to_lng, role, arrival_time, from_place_id, to_place_id, trip_id, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of oldItems) {
    const fromPlaceId = row.from_place_id != null ? placeToSpotId.get(row.from_place_id as number) ?? null : null;
    const toPlaceId = row.to_place_id != null ? placeToSpotId.get(row.to_place_id as number) ?? null : null;
    insertItem.run(
      row.id,
      row.title,
      row.type,
      row.from_location,
      row.to_location,
      row.date,
      row.departure_time,
      row.checkin_info,
      row.amount,
      row.paid_by_user_id,
      row.luggage,
      row.seat,
      row.link,
      row.note,
      row.budget_expense_id,
      row.from_maps_link,
      row.from_lat,
      row.from_lng,
      row.to_maps_link,
      row.to_lat,
      row.to_lng,
      row.role,
      row.arrival_time,
      fromPlaceId,
      toPlaceId,
      row.trip_id,
      row.deleted_at,
    );
  }
  db.exec('DROP TABLE travel_items_migrating');

  // station_keys, die bislang auf einen eigenen "travel-place-<id>"-Eintrag zeigten (vorheriger
  // Batch, siehe utils/excursionStations.ts), zeigen jetzt direkt auf den entsprechenden Spot
  // ('spot-<neue id>') – derselbe Ort, kein eigener Stations-Typ mehr nötig. Nur relevant, solange
  // excursion_spots noch die alte station_key-Spalte hat (siehe die spätere Tagging-Vereinfachungs-
  // Migration unten) – auf einer brandneuen DB hat excursion_spots von Anfang an nur noch spot_id,
  // ein unbedingtes SELECT auf station_key würde dort mit "no such column" fehlschlagen.
  if (hasColumn('excursion_spots', 'station_key')) {
    const legacyStationRows = db
      .prepare(`SELECT id, station_key FROM excursion_spots WHERE station_key LIKE 'travel-place-%'`)
      .all() as { id: number; station_key: string }[];
    const updateStationKey = db.prepare('UPDATE excursion_spots SET station_key = ? WHERE id = ?');
    for (const row of legacyStationRows) {
      const oldPlaceId = Number(row.station_key.slice('travel-place-'.length));
      const newSpotId = placeToSpotId.get(oldPlaceId);
      if (newSpotId != null) updateStationKey.run(`spot-${newSpotId}`, row.id);
    }
  }

  db.exec('DROP TABLE travel_places');
}

// Unterkunft (accommodation) verschmilzt mit Spots: bisher eine eigene Mini-Tabelle für i. d. R.
// genau einen Ort mit ein paar mehr Feldern (Adresse, Zeitraum, Check-in/-out, Kontakt, Kosten) –
// jetzt einfach ein Spot der Kategorie "Unterkunft" mit denselben Zusatzfeldern (siehe
// ensureColumn('spots', 'address', …) weiter oben). id bleibt NICHT erhalten (anders als bei der
// travel_places-Migration oben) – nichts referenziert accommodation.id per SQL-FK, nur
// excursion_spots' 'accommodation-<id>'-Stationsschlüssel und attachments' domain='accommodation'
// (beide werden unten auf die neue Spot-Id umgeschrieben), daher genügt eine einfache Id-Um-Map
// ohne Tabellen-Neubau.
if (hasTable('accommodation')) {
  interface LegacyAccommodationRow {
    id: number;
    trip_id: number;
    name: string;
    address: string | null;
    maps_link: string | null;
    start_date: string | null;
    end_date: string | null;
    checkin: string | null;
    checkout: string | null;
    contact: string | null;
    note: string | null;
    lat: number | null;
    lng: number | null;
    amount: number | null;
    paid_by_user_id: number | null;
    budget_expense_id: number | null;
    deleted_at: string | null;
  }
  const accommodations = db.prepare('SELECT * FROM accommodation').all() as LegacyAccommodationRow[];
  const accommodationToSpotId = new Map<number, number>();
  // Statement nur vorbereiten, wenn tatsächlich Zeilen zu übernehmen sind – accommodation existiert
  // dank CREATE TABLE IF NOT EXISTS oben auf JEDER (auch brandneuen/Test-)DB, meist aber leer; ein
  // vorbereitetes INSERT würde sonst unnötig gegen alle Zielspalten (u. a. spots.note) validiert.
  if (accommodations.length > 0) {
    const insertAccommodationSpot = db.prepare(`
      INSERT INTO spots (
        trip_id, title, category, note, maps_link, lat, lng, address, start_date, end_date,
        checkin, checkout, contact, amount, paid_by_user_id, budget_expense_id, deleted_at
      ) VALUES (?, ?, 'Unterkunft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of accommodations) {
      const result = insertAccommodationSpot.run(
        a.trip_id,
        a.name,
        a.note,
        a.maps_link,
        a.lat,
        a.lng,
        a.address,
        a.start_date,
        a.end_date,
        a.checkin,
        a.checkout,
        a.contact,
        a.amount,
        a.paid_by_user_id,
        a.budget_expense_id,
        a.deleted_at,
      );
      accommodationToSpotId.set(a.id, result.lastInsertRowid as number);
    }
  }

  // station_keys, die bislang auf 'accommodation-<id>' zeigten, zeigen jetzt direkt auf den
  // entsprechenden Spot ('spot-<neue id>') – derselbe Ort, kein eigener Stations-Typ mehr nötig
  // (siehe utils/excursionStations.ts). Nur relevant, solange excursion_spots noch die alte
  // station_key-Spalte hat (siehe die spätere Tagging-Vereinfachungs-Migration unten) – auf einer
  // brandneuen DB hat excursion_spots von Anfang an nur noch spot_id, ein unbedingtes SELECT auf
  // station_key würde dort mit "no such column" fehlschlagen.
  if (hasColumn('excursion_spots', 'station_key')) {
    const legacyAccommodationStationRows = db
      .prepare(`SELECT id, station_key FROM excursion_spots WHERE station_key LIKE 'accommodation-%'`)
      .all() as { id: number; station_key: string }[];
    const updateAccommodationStationKey = db.prepare('UPDATE excursion_spots SET station_key = ? WHERE id = ?');
    for (const row of legacyAccommodationStationRows) {
      const oldAccommodationId = Number(row.station_key.slice('accommodation-'.length));
      const newSpotId = accommodationToSpotId.get(oldAccommodationId);
      if (newSpotId != null) updateAccommodationStationKey.run(`spot-${newSpotId}`, row.id);
    }
  }

  // Datei-Anhänge (routes/attachments.ts) hingen bisher an domain='accommodation' + der alten
  // accommodation.id – zeigen jetzt auf domain='spots' + die neue Spot-Id, sonst verlöre man beim
  // nächsten Öffnen kommentarlos den Zugriff auf bereits hochgeladene Tickets/Dokumente.
  const legacyAccommodationAttachmentRows = db
    .prepare(`SELECT id, entity_id FROM attachments WHERE domain = 'accommodation'`)
    .all() as { id: number; entity_id: number }[];
  const updateAttachmentDomain = db.prepare(`UPDATE attachments SET domain = 'spots', entity_id = ? WHERE id = ?`);
  for (const row of legacyAccommodationAttachmentRows) {
    const newSpotId = accommodationToSpotId.get(row.entity_id);
    if (newSpotId != null) updateAttachmentDomain.run(newSpotId, row.id);
  }

  db.exec('DROP TABLE accommodation');
}

// Touren (Ausflüge) verlieren ihren generischen station_key zugunsten einer echten spot_id-Fremd-
// schlüsselspalte (siehe CREATE TABLE excursion_spots oben) – Reihenfolge (position) und Mehrfach-
// besuch (kein UNIQUE) bleiben erhalten, nur der Stationstyp ist jetzt IMMER ein echter Spot (siehe
// dortiger Kommentar). Muss NACH den travel_places-/accommodation-Migrationsblöcken oben laufen:
// die schreiben 'travel-place-<id>'/'accommodation-<id>'-Stationsschlüssel bereits auf 'spot-<id>'
// um, und travel_items.from_place_id/to_place_id zeigen an dieser Stelle schon auf spots(id) statt
// travel_places(id) (siehe dortiger Kommentar) – beides wird hier gebraucht, um alte Stations-
// schlüssel auf eine Spot-Id aufzulösen. Gate über die alte station_key-Spalte statt hasTable():
// excursion_spots existiert dank CREATE TABLE IF NOT EXISTS oben immer schon (auch auf einer
// brandneuen DB, dort aber bereits im neuen Schema, siehe oben – hasColumn liefert dann false,
// Migration bleibt ein No-Op).
if (hasColumn('excursion_spots', 'station_key')) {
  interface LegacyExcursionSpotRow {
    id: number;
    idea_id: number;
    station_key: string;
    position: number;
  }
  const legacyRows = db.prepare('SELECT * FROM excursion_spots').all() as LegacyExcursionSpotRow[];

  // Löst einen alten station_key auf eine Spot-Id auf – 'travel-from-<id>'/'travel-to-<id>' nur,
  // wenn die Etappe tatsächlich einen verknüpften Ort hat (from_place_id/to_place_id), sonst (reine
  // Freitext-Etappe ohne eigenen Spot) gibt es dafür in der neuen, spot-only Tour-Welt keine
  // Entsprechung mehr – diese Station fällt ersatzlos weg (der einzige echte Funktionsverlust
  // dieser Migration, alles andere - Reihenfolge, Mehrfachbesuch - bleibt erhalten).
  function resolveLegacySpotId(stationKey: string): number | null {
    if (stationKey.startsWith('spot-')) {
      return Number(stationKey.slice('spot-'.length));
    }
    const isFrom = stationKey.startsWith('travel-from-');
    const isTo = stationKey.startsWith('travel-to-');
    if (!isFrom && !isTo) return null;
    const travelId = Number(stationKey.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    const travelItem = db
      .prepare(`SELECT from_place_id, to_place_id FROM travel_items WHERE id = ?`)
      .get(travelId) as { from_place_id: number | null; to_place_id: number | null } | undefined;
    if (!travelItem) return null;
    return (isFrom ? travelItem.from_place_id : travelItem.to_place_id) ?? null;
  }

  db.exec('ALTER TABLE excursion_spots RENAME TO excursion_spots_migrating');
  db.exec(`
    CREATE TABLE excursion_spots (
      id INTEGER PRIMARY KEY,
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      spot_id INTEGER NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
      position INTEGER NOT NULL DEFAULT 0
    )
  `);
  if (legacyRows.length > 0) {
    // Nur vorbereiten, wenn tatsächlich Altzeilen existieren (gleiches Muster wie die
    // Unterkunft-Migration oben) – auf einer frischen DB ohne station_key-Spalte greift dieser
    // Zweig ohnehin nie.
    const insertSpotLink = db.prepare(
      'INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)',
    );
    const spotExists = db.prepare('SELECT 1 FROM spots WHERE id = ?');
    for (const row of legacyRows) {
      const spotId = resolveLegacySpotId(row.station_key);
      // Sowohl unauflösbare (s. o.) als auch auf mittlerweile gelöschte Spots zeigende Stationen
      // (alte station_key-Strings hatten keinen SQL-FK, ein Spot-Löschen konnte sie daher als
      // Karteileiche zurücklassen) werden übersprungen statt gegen den neuen FK zu verstoßen.
      if (spotId == null || !spotExists.get(spotId)) continue;
      insertSpotLink.run(row.idea_id, spotId, row.position);
    }
  }
  db.exec('DROP TABLE excursion_spots_migrating');
}

// Ordnet einer Trash-Tabelle (falls vorhanden) ihre Attachment-Domäne zu (siehe
// routes/attachments.ts's DOMAIN_TABLE) – nur diese 5 Tabellen können Datei-Anhänge tragen.
const ATTACHMENT_DOMAIN_BY_TABLE: Partial<Record<(typeof TRASH_TABLES)[number], string>> = {
  schedule_items: 'schedule',
  spots: 'spots',
  notes: 'notes',
  // ideas trägt seit #176 (Ablösung von travel_items) Anhänge für Touren mit gesetzter role
  // (ehemalige Reise-Etappen), siehe routes/attachments.ts's DOMAIN_TABLE.
  ideas: 'ideas',
  budget_items: 'budget',
};

// Endgültiges Aufräumen (optional, siehe CLAUDE.md-Auftrag "kein Muss"): Objekte, die länger als
// 30 Tage im Papierkorb liegen, werden beim Backend-Start hart gelöscht. budget_transfers hat kein
// trip_id (siehe CREATE TABLE oben), braucht daher keinen Join/Backfill – deleted_at reicht für den
// Alters-Check bei allen Tabellen gleichermaßen aus. Vor dem Hart-Löschen werden zugehörige
// Datei-Anhänge (falls die Tabelle Anhänge tragen kann) mit aufgeräumt, sonst blieben deren Dateien
// dauerhaft verwaist auf der Platte liegen.
export function purgeOldTrash(maxAgeDays = 30) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  for (const table of TRASH_TABLES) {
    const attachmentDomain = ATTACHMENT_DOMAIN_BY_TABLE[table];
    if (attachmentDomain) {
      const staleRows = db
        .prepare(`SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < ?`)
        .all(cutoff) as { id: number }[];
      purgeAttachmentsForEntities(attachmentDomain, staleRows.map((r) => r.id));
    }
    db.prepare(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < ?`).run(cutoff);
  }
}
purgeOldTrash();

// Append-only Aktivitäts-Log (Echtzeit-Sync/Nav-Badges/Push, siehe activity.ts): eine Zeile pro
// Mutation (angelegt/geändert/gelöscht/wiederhergestellt/Mitglied hinzugefügt/entfernt). Bewusst
// eine einzige generische Tabelle statt pro Domäne eigener Spalten – entity_id ist nullable für
// domänenweite Ereignisse ohne einzelne Objekt-id (z. B. "Mitglied eingeladen"). Dient sowohl als
// Quelle für den SSE-Broadcast im selben Moment als auch als Nachhol-Protokoll für Clients, die beim
// Ändern nicht verbunden waren (GET /trip-activity?since=).
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_activity (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    entity_id INTEGER,
    action TEXT NOT NULL,
    actor_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_trip_activity_trip_created ON trip_activity (trip_id, created_at)');

export function purgeOldActivity(maxAgeDays = 30) {
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('DELETE FROM trip_activity WHERE created_at < ?').run(cutoff);
}
purgeOldActivity();

// Web-Push-Abonnements (Push-Benachrichtigungen, siehe push.ts): ein Browser/Gerät je Zeile, per
// endpoint eindeutig (derselbe Nutzer kann auf mehreren Geräten abonniert sein). p256dh/auth sind
// die vom Browser gelieferten Verschlüsselungsschlüssel für die Push-Nachricht (PushSubscriptionJSON).
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// Push-Benachrichtigungs-Präferenzen pro Nutzer:in und Domäne (differenzierte Stufen statt eines
// globalen An/Aus, siehe ProfileView.vue). Key-Value statt einer Spalte pro Domäne (analog
// stores/navConfig.ts): fehlende Zeile für (user_id, domain) bedeutet "aktiviert" (Default true) -
// das erhält für alle, die Push schon vor diesem Feature aktiviert hatten, unverändert das
// bisherige "Alles"-Verhalten, ohne dass eine künftig neu hinzukommende Domäne eine Migration
// bräuchte.
db.exec(`
  CREATE TABLE IF NOT EXISTS push_preferences (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    PRIMARY KEY (user_id, domain)
  );
`);

// Reiseregion-Infos (Dashboard-Widget, siehe utils/regionInfo.ts): einmalig per Reverse-Geocoding
// aus lat/lng ermittelt und dauerhaft gecacht, nur neu aufgelöst, wenn sich lat/lng ändern.
ensureColumn('trips', 'country_code', 'TEXT');
ensureColumn('trips', 'country_name', 'TEXT');

// Merkt sich, welche "Bis zur Abreise"-Erinnerungs-Push (departureReminders.ts, Schwellwerte in
// Tagen vor Abreise) für welchen Urlaub schon verschickt wurde - ohne das würde derselbe
// Schwellwert bei jedem periodischen Check (bzw. nach jedem Server-Neustart) erneut ausgelöst.
// Zusammengesetzter Primärschlüssel statt eigener id-Spalte, da (trip_id, threshold_days) bereits
// eindeutig ist und die Abfrage "wurde dieser Schwellwert schon verschickt?" so ohne zusätzlichen
// Index auskommt.
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_departure_reminders_sent (
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    threshold_days INTEGER NOT NULL,
    sent_at TEXT NOT NULL,
    PRIMARY KEY (trip_id, threshold_days)
  );
`);

// Tägliche Wetter-Ist-Werte für die Urlaubsregion (weatherSnapshots.ts, periodischer Scheduler wie
// departureReminders.ts oben) - Open-Meteo selbst liefert live nur ~16 Tage Vorhersage plus 1 Tag
// rückwirkend (siehe frontend/src/utils/weather.ts), ohne diese Tabelle wäre das Wetter eines
// Urlaubs nach Ablauf dieses Fensters unwiederbringlich weg. Nur strikt vergangene, abgeschlossene
// Tage werden hier gespeichert (siehe weatherSnapshots.ts) - der laufende Tag bleibt bewusst live
// abgefragt, sein Wert ist bei Open-Meteo noch nicht final. Feldnamen bewusst nah an
// utils/weather.ts's DailyWeather, damit GET /trips/:id/weather-history ohne Übersetzung
// konsumierbar ist.
db.exec(`
  CREATE TABLE IF NOT EXISTS trip_weather_snapshots (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    weathercode INTEGER NOT NULL,
    temp_max REAL NOT NULL,
    temp_min REAL NOT NULL,
    precipitation_probability REAL,
    UNIQUE(trip_id, date)
  );
`);

// Zwischenspeicher für noch nicht abgeschickte Create-/Edit-Formulare (Nutzer-Feedback: Eingaben
// sollen bei einem App-Absturz nicht verloren gehen) - siehe routes/drafts.ts und
// frontend/src/composables/useDraftAutosave.ts. Rein persönlich (pro user_id), nicht über
// trip_members/Echtzeit-Sync geteilt - ein Entwurf ist kein fertiges Domänen-Objekt, das andere
// Mitglieder sehen sollen. Kein deleted_at/Papierkorb-Eintrag wie bei den 11 echten Domänen-
// Tabellen (siehe CLAUDE.md) - ein Entwurf ist Ablage-Infrastruktur wie sessions/
// push_subscriptions, kein wiederherstellbares Nutzerobjekt.
db.exec(`
  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    draft_key TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, trip_id, draft_key)
  );
`);

// Ob die Packlisten-Kategorie beim Anlegen/Bearbeiten eines Gegenstands Pflichtfeld ist (Standard:
// ja) - pro Urlaub statt global, da unterschiedliche Trips das unterschiedlich streng handhaben
// wollen können. NOT NULL DEFAULT 1 statt nullable: additiv unbedenklich (kein Datenverlust, siehe
// CLAUDE.md "Datenmodell-Änderungen"), und macht "noch nicht konfiguriert" unnötig - alle
// bestehenden Trips bekommen automatisch die gewünschte neue Standardeinstellung "Pflicht". Gilt nur
// für neue/bearbeitete Gegenstände, bereits vorhandene Einträge ohne Kategorie werden dadurch nicht
// rückwirkend zurückgewiesen (siehe routes/packing.ts).
ensureColumn('trips', 'packing_category_required', 'INTEGER NOT NULL DEFAULT 1');

// Format der Freitext-/Notizfelder, die früher als reiner Markdown-ähnlicher Text galten und über
// utils/richText.ts gerendert wurden - der neue WYSIWYG-Editor (RichTextEditor.vue) schreibt
// stattdessen sanitiztes HTML. 'legacy' (Default) markiert bereits vorhandene Zeilen: sie werden
// weiterhin über renderRichText() angezeigt (siehe RichTextDisplay.vue), 'html' markiert neu über
// den Editor gespeicherte Inhalte. Bewusst ein Format-Flag statt einer Content-Sniffing-Heuristik -
// eindeutig statt zu raten, ob ein gespeicherter String Markdown-Text oder schon HTML ist. Kein
// Backfill nötig (reiner Default, keine Bedeutungsverschiebung bestehender Werte).
ensureColumn('notes', 'content_format', "TEXT NOT NULL DEFAULT 'legacy'");
ensureColumn('diary_entries', 'content_format', "TEXT NOT NULL DEFAULT 'legacy'");
ensureColumn('ideas', 'note_format', "TEXT NOT NULL DEFAULT 'legacy'");
ensureColumn('spots', 'note_format', "TEXT NOT NULL DEFAULT 'legacy'");

// Frei änderbares "Datum des Eintrags" (z. B. rückblickend am Folgetag über den Vortag geschrieben) -
// bisher gab es dafür nur das unveränderliche created_at (Zeitpunkt des Speicherns). Nullable statt
// NOT NULL DEFAULT: bestehende Zeilen brauchen einen echten Backfill (das Datum von created_at
// übernehmen), nicht nur einen pauschalen Default-Wert, sonst würden alte Einträge alle denselben
// falschen Tag zeigen. Neue Einträge setzen das Feld immer explizit (siehe routes/diary.ts).
ensureColumn('diary_entries', 'date', 'TEXT');
db.exec("UPDATE diary_entries SET date = substr(created_at, 1, 10) WHERE date IS NULL");

// "Gemacht"-Status: unabhängiges Flag neben geplant/ungeplant (das weiterhin rein aus verknüpften
// schedule_items abgeleitet wird, siehe Kommentar bei den ideas-Migrationen oben) - auch spontane,
// nie geplante Besuche sollen als erledigt markierbar sein, ohne dass das ursprüngliche
// Datum/geplant-Feld dafür ersetzt oder angetastet wird. Eigenes Feld auf beiden Tabellen (nicht nur
// auf ideas), weil ein einzelner Spot auch unabhängig von jeder Tour als gemacht markierbar sein
// muss. NOT NULL DEFAULT 0 statt nullable: additiv unbedenklich, kein Backfill nötig (neue Spalte,
// alle bestehenden Zeilen sind naturgemäß "noch nicht gemacht").
ensureColumn('spots', 'done', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('ideas', 'done', 'INTEGER NOT NULL DEFAULT 0');

// Standort-Aufzeichnung ("wo war ich wirklich?", im Gegensatz zum rein ephemeren Live-Standort in
// activity.ts's lastPositionsByTrip): eine Aufzeichnungs-Sitzung (location_tracks) plus die dabei
// gesammelten GPS-Punkte (location_track_points). Komplett neue Tabellen, kein Backfill nötig.
// visibility folgt demselben 🔒/🤝-Konzept wie private/geteilte Budget-Töpfe (siehe DESIGN.md):
// 'private' (Standard) ist nur für die aufzeichnende Person sichtbar, 'shared' für alle
// Trip-Mitglieder. excursion_id ist optional (ON DELETE SET NULL statt CASCADE, analog zu
// schedule_items.spot_id) - eine Aufzeichnung bleibt als eigenständiges Objekt bestehen, auch wenn
// die verknüpfte Tour später gelöscht wird.
db.exec(`
  CREATE TABLE IF NOT EXISTS location_tracks (
    id INTEGER PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    excursion_id INTEGER REFERENCES ideas(id) ON DELETE SET NULL,
    title TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    started_at TEXT NOT NULL,
    ended_at TEXT,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS location_track_points (
    id INTEGER PRIMARY KEY,
    track_id INTEGER NOT NULL REFERENCES location_tracks(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    recorded_at TEXT NOT NULL,
    accuracy REAL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_track_points_track_recorded ON location_track_points (track_id, recorded_at)');

// Entwurfs-Status als sichtbarer, weiterbearbeitbarer Eintrag statt nur der bisherigen, unsichtbaren
// Zwischenspeicherung in `drafts` (#89: Nutzer-Feedback, ein per useDraftAutosave gesichertes
// Formular verschwand beim Schließen des Dialogs spurlos - weder in der Übersicht sichtbar noch beim
// nächsten "Neuer Eintrag" wiederzufinden). Additiv mit Default 0 (kein Backfill nötig): bestehende
// Notizen/Tagebucheinträge sind alle bereits veröffentlicht. Sichtbarkeit wird in den jeweiligen
// GET-Routen (routes/notes.ts, routes/diary.ts) auf die eigene user_id/author_id beschränkt - ein
// Entwurf ist wie ein persönlicher `drafts`-Eintrag nie für andere Trip-Mitglieder sichtbar.
ensureColumn('notes', 'is_draft', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('diary_entries', 'is_draft', 'INTEGER NOT NULL DEFAULT 0');

// Icon-Stil-Einstellungen (App-Einstellungen-Tab, #105): waren bisher nur in localStorage
// (stores/iconStyle.ts) und damit pro Gerät statt pro Account. Ein JSON-Blob statt Einzelspalten -
// die Einstellung wird immer als Ganzes vom Frontend geladen/gespeichert (wie der bisherige
// localStorage-Zustand), eine eigene Tabelle mit einer Spalte pro Feld wäre hier reiner Overhead.
// NULL = noch nie gespeichert, Frontend füllt dann seine lokalen Defaults.
ensureColumn('users', 'icon_settings', 'TEXT');

// Notification-Inbox (#97): merkt sich pro Nutzer:in, welche trip_activity-Zeilen bereits gelesen
// wurden (Klick auf die Nachricht bzw. "Alle als gelesen markieren", siehe routes/notifications.ts).
// Komplett neue, additive Tabelle statt einer Spalte auf trip_activity - eine Aktivität wird von
// mehreren Mitgliedern unabhängig voneinander gelesen, eine einzelne "read"-Spalte auf trip_activity
// könnte das nicht abbilden. ON DELETE CASCADE auf activity_id, damit purgeOldActivity() (siehe
// dortiger Kommentar) keine verwaisten Zeilen hinterlässt.
db.exec(`
  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id INTEGER NOT NULL REFERENCES trip_activity(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL,
    PRIMARY KEY (user_id, activity_id)
  );
`);

// #96: konfigurierbare Registrierung (REGISTRATION_MODE=off/full/restricted, siehe
// registrationConfig.ts). Wird beim Registrieren gesetzt (routes/auth.ts) und bleibt danach
// bestehen, auch wenn REGISTRATION_MODE später geändert wird – kein Backfill nötig, da additiv mit
// Default 0 (alle bisherigen Accounts sind unrestricted).
ensureColumn('users', 'is_restricted', 'INTEGER NOT NULL DEFAULT 0');

// #68: Zusammenführung von Touren/Routen/Reisen. Eine Reise-Etappe (travel_items) ist im Kern eine
// Tour mit genau zwei Stationen (Von/Nach) plus Transportmittel-Zusatzfeldern – diese Zusatzfelder
// wandern additiv auf ideas (Touren), als Grundlage für die spätere Ablösung von travel_items/
// TravelView.vue/dem NavBar-Punkt "Reise" (siehe Konzept-Kommentar in Issue #68, UI-Umsetzung in
// #175). budget_expense_id bleibt bewusst NICHT auf ideas gespiegelt: der Budget-Sync-Eintrag gehört
// bis zur tatsächlichen Route/UI-Ablösung weiterhin exklusiv dem alten travel_items-Eintrag
// (routes/travel.ts) – sonst würden zwei Objekte denselben budget_items-Datensatz beanspruchen und
// sich beim Löschen gegenseitig die Ausgabe wegreißen. Budget-Sync/Anhänge/Kalender-Verknüpfung auf
// das neue Modell umstellen und travel_items danach entfernen: #176.
ensureColumn('ideas', 'role', 'TEXT');
ensureColumn('ideas', 'transport_type', 'TEXT');
ensureColumn('ideas', 'departure_time', 'TEXT');
ensureColumn('ideas', 'arrival_time', 'TEXT');
ensureColumn('ideas', 'checkin_info', 'TEXT');
ensureColumn('ideas', 'amount', 'REAL');
ensureColumn('ideas', 'paid_by_user_id', 'INTEGER REFERENCES users(id)');
ensureColumn('ideas', 'luggage', 'TEXT');
ensureColumn('ideas', 'seat', 'TEXT');
ensureColumn('ideas', 'ticket_link', 'TEXT');
// #176: eigene budget_expense_id-Spalte auf ideas, damit eine Tour mit role/amount/paid_by_user_id
// (ehemalige Reise-Etappe) genau wie ein Unterkunft-Spot/eine Reise-Etappe eine Ausgabe in
// budget_items führen kann (Sync-Logik siehe routes/ideas.ts's planIdeaBudgetExpense()).
ensureColumn('ideas', 'budget_expense_id', 'INTEGER REFERENCES budget_items(id)');

// #176: vollständige Ablösung von travel_items durch ideas (role/transport_type/...). Läuft nur auf
// einer DB, die travel_items tatsächlich noch besitzt (siehe Kommentar bei der entfernten CREATE
// TABLE weiter oben) - jede Zeile wird als Tour mit ihren Von-/Nach-Stationen gespiegelt (bereits
// gespiegelte Zeilen, markiert per travel_items.migrated_idea_id, werden nicht erneut angelegt,
// aber weiterhin auf fehlenden Kalender-Termin/fehlende Budget-Ausgabe geprüft - das deckt auch
// Zeilen ab, die schon auf einer früher deployten Umgebung gespiegelt wurden, bevor es diese
// Zusatzfelder gab). Anschließend werden Anhänge umgehängt und die Tabelle gedroppt - anders als bei
// den travel_places-/accommodation-Migrationen oben also EIN Block für Spiegeln UND endgültige
// Ablösung, weil travel_items hier nie wieder beschrieben wird (routes/travel.ts entfällt komplett).
if (hasTable('travel_items')) {
  ensureColumn('travel_items', 'migrated_idea_id', 'INTEGER REFERENCES ideas(id) ON DELETE SET NULL');

  interface TravelRow {
    id: number;
    trip_id: number;
    title: string;
    type: string | null;
    note: string | null;
    note_format: string;
    role: string | null;
    date: string | null;
    departure_time: string | null;
    arrival_time: string | null;
    checkin_info: string | null;
    amount: number | null;
    paid_by_user_id: number | null;
    luggage: string | null;
    seat: string | null;
    link: string | null;
    from_location: string | null;
    from_maps_link: string | null;
    from_lat: number | null;
    from_lng: number | null;
    from_place_id: number | null;
    to_location: string | null;
    to_maps_link: string | null;
    to_lat: number | null;
    to_lng: number | null;
    to_place_id: number | null;
    budget_expense_id: number | null;
    deleted_at: string | null;
    migrated_idea_id: number | null;
  }

  const allRows = db.prepare('SELECT * FROM travel_items').all() as TravelRow[];

  // Statements erst vorbereiten, wenn wirklich etwas zu tun ist - vermeidet, dass diese Migration auf
  // einer (Test-)DB mit stark reduziertem ideas-Schema (kein travel_items-Datensatz, also nichts zu
  // tun) allein am Vorbereiten von Spalten scheitert, die dieser Testfall gar nicht besitzt.
  if (allRows.length > 0) {
    const insertIdea = db.prepare(`
      INSERT INTO ideas (
        title, note, note_format, trip_id, role, transport_type, departure_time, arrival_time,
        checkin_info, amount, paid_by_user_id, luggage, seat, ticket_link, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSpot = db.prepare(
      'INSERT INTO spots (trip_id, title, maps_link, lat, lng) VALUES (?, ?, ?, ?, ?)',
    );
    const insertStation = db.prepare('INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)');
    const markMigrated = db.prepare('UPDATE travel_items SET migrated_idea_id = ? WHERE id = ?');
    const hasSchedule = db.prepare('SELECT 1 FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL');
    const insertSchedule = db.prepare(
      'INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)',
    );
    const getIdeaBudgetExpense = db.prepare('SELECT budget_expense_id FROM ideas WHERE id = ?');
    const setIdeaBudgetExpense = db.prepare('UPDATE ideas SET budget_expense_id = ? WHERE id = ?');

    for (const row of allRows) {
      let ideaId = row.migrated_idea_id;

      if (ideaId == null) {
        ideaId = insertIdea.run(
          row.title,
          row.note,
          row.note_format ?? 'legacy',
          row.trip_id,
          row.role,
          row.type,
          row.departure_time,
          row.arrival_time,
          row.checkin_info,
          row.amount,
          row.paid_by_user_id,
          row.luggage,
          row.seat,
          row.link,
          row.deleted_at,
        ).lastInsertRowid as number;

        let position = 0;
        const addStation = (
          placeId: number | null,
          location: string | null,
          mapsLink: string | null,
          lat: number | null,
          lng: number | null,
        ) => {
          const spotId =
            placeId ?? (location ? (insertSpot.run(row.trip_id, location, mapsLink, lat, lng).lastInsertRowid as number) : null);
          if (spotId == null) return;
          insertStation.run(ideaId, spotId, position);
          position += 1;
        };
        addStation(row.from_place_id, row.from_location, row.from_maps_link, row.from_lat, row.from_lng);
        addStation(row.to_place_id, row.to_location, row.to_maps_link, row.to_lat, row.to_lng);

        markMigrated.run(ideaId, row.id);
      }

      // Kalender-Termin nachziehen, falls die gespiegelte Tour noch keinen hat (deckt sowohl frisch
      // gespiegelte als auch ältere, schon gespiegelte Zeilen ab - siehe Blockkommentar oben).
      if (row.date && !hasSchedule.get(ideaId)) {
        insertSchedule.run(row.trip_id, row.date, row.title, ideaId);
      }

      // Budget-Ausgabe übernehmen (Ownership-Wechsel, keine neue Zeile) statt zu duplizieren - nur
      // falls die Tour noch keine eigene budget_expense_id trägt.
      if (row.budget_expense_id) {
        const idea = getIdeaBudgetExpense.get(ideaId) as { budget_expense_id: number | null } | undefined;
        if (idea && idea.budget_expense_id == null) {
          setIdeaBudgetExpense.run(row.budget_expense_id, ideaId);
        }
      }
    }

    // Anhänge (Buchungsbestätigungen/Tickets, siehe routes/attachments.ts) von der alten
    // travel_items-Zeile auf die gespiegelte Tour umhängen - erst danach kann travel_items
    // gefahrlos fallen, ohne dass Datei-Referenzen ins Leere zeigen.
    const travelAttachments = db
      .prepare(`SELECT id, entity_id FROM attachments WHERE domain = 'travel'`)
      .all() as { id: number; entity_id: number }[];
    if (travelAttachments.length > 0) {
      const findMigratedIdea = db.prepare('SELECT migrated_idea_id FROM travel_items WHERE id = ?');
      const moveAttachment = db.prepare(`UPDATE attachments SET domain = 'ideas', entity_id = ? WHERE id = ?`);
      for (const a of travelAttachments) {
        const ti = findMigratedIdea.get(a.entity_id) as { migrated_idea_id: number | null } | undefined;
        if (ti?.migrated_idea_id != null) moveAttachment.run(ti.migrated_idea_id, a.id);
      }
    }
  }

  db.exec('DROP TABLE travel_items');
}
