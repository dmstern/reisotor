import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

-- Ein Budget ist entweder persönlich (owner_id gesetzt) oder geteilt (owner_id NULL).
-- Es gibt kein manuelles Gesamtbudget mehr – die Gesamtsumme ergibt sich aus der Summe
-- aller budget_allocations über alle Budgets eines Urlaubs.
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

CREATE TABLE IF NOT EXISTS travel_items (
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
  budget_expense_id INTEGER REFERENCES budget_items(id)
);

-- Wiederverwendbare Orte für Reise-Etappen (Batch: Reise/Flüge schlauer machen) – statt bei jeder
-- Etappe "Von"/"Nach" samt Maps-Link erneut einzutippen, werden Start/Ziel einmal als Ort angelegt
-- und dann aus mehreren Etappen heraus referenziert (siehe travel_items.from_place_id/to_place_id
-- weiter unten). is_home markiert "zuhause"-Orte, ersetzt für neu angelegte Etappen die bisher
-- manuell zu setzende travel_items.role (die Rolle lässt sich daraus automatisch ableiten).
CREATE TABLE IF NOT EXISTS travel_places (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_home INTEGER NOT NULL DEFAULT 0,
  maps_link TEXT,
  lat REAL,
  lng REAL
);

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

-- Stationen eines Ausflugs: welche Orte gehören zu welchem Ausflug, in welcher Reihenfolge
-- (Batch 13, Reihenfolge/Mehrfachbesuche nachgerüstet; Batch 14: generischer station_key statt
-- spot_id). Eine Station ist NICHT mehr zwingend ein echter Spot – station_key trägt stattdessen
-- einen generischen Schlüssel im selben Format wie MapPoint.key/DerivedLocation.key
-- ('spot-<id>', 'accommodation-<id>', 'travel-from-<id>', 'travel-to-<id>'), damit Unterkunft/
-- Anreise-/Abreise-Orte als Station eingeplant werden können, ohne dafür einen doppelten Spot
-- anzulegen. Bewusst KEIN UNIQUE(idea_id, station_key) – ein Rundgang darf denselben Ort mehrfach
-- enthalten (z. B. Start UND Ende an der Unterkunft), "position" ist deshalb die eigentliche
-- Quelle der Abklapper-Reihenfolge, nicht die Zeilen-Id.
CREATE TABLE IF NOT EXISTS excursion_spots (
  id INTEGER PRIMARY KEY,
  idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  station_key TEXT NOT NULL,
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
// ohne bestehende Daten in data.sqlite zu verlieren.
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

// excursion_spots hatte ursprünglich UNIQUE(idea_id, spot_id) und eine feste spot_id-Spalte statt
// des generischen station_key – beides verhindert(e), was ein Rundgang bzw. eine Unterkunft/Reise
// als Station braucht (siehe Kommentar am CREATE TABLE oben). SQLite kann weder eine Tabellen-
// Constraint noch eine Spalten-Bedeutung per ALTER TABLE ändern, bei Altbeständen wird die Tabelle
// daher einmalig neu aufgebaut. Gate über das Fehlen der station_key-Spalte statt eines Text-Checks
// auf UNIQUE, da mittlerweile zwei verschiedene Alt-Schemata (mit/ohne UNIQUE, aber beide noch mit
// spot_id) auf diesen einen Rebuild treffen können.
function migrateExcursionStations() {
  if (!hasTable('excursion_spots') || hasColumn('excursion_spots', 'station_key')) return;
  db.exec(`
    ALTER TABLE excursion_spots RENAME TO excursion_spots_old;
    CREATE TABLE excursion_spots (
      id INTEGER PRIMARY KEY,
      idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
      station_key TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO excursion_spots (id, idea_id, station_key, position)
      SELECT id, idea_id, 'spot-' || spot_id, COALESCE(position, id) FROM excursion_spots_old;
    DROP TABLE excursion_spots_old;
  `);
}
migrateExcursionStations();

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
// Standort Abflug-/Ankunftsort eines Reise-Eintrags (Batch 13) – analog zum maps_link/lat/lng-
// Muster bei Ausflügen/Unterkunft, hier je einmal für "Von" und "Nach".
ensureColumn('travel_items', 'from_maps_link', 'TEXT');
ensureColumn('travel_items', 'from_lat', 'REAL');
ensureColumn('travel_items', 'from_lng', 'REAL');
ensureColumn('travel_items', 'to_maps_link', 'TEXT');
ensureColumn('travel_items', 'to_lat', 'REAL');
ensureColumn('travel_items', 'to_lng', 'REAL');
// Rolle des Reise-Eintrags: 'arrival' (Anreise, von zuhause zum Urlaubsziel), 'departure'
// (Abreise, vom Urlaubsziel nach zuhause) oder 'onward' (Weiterreise zwischen zwei Orten
// innerhalb des Urlaubs). Damit kann die Karte "Auf Urlaubsziel fokussieren" die Start-/
// Zielpunkte zuhause zuverlässig von den eigentlichen Urlaubsorten unterscheiden.
ensureColumn('travel_items', 'role', 'TEXT');
// Ankunftszeit zusätzlich zur Abflugzeit – erlaubt die automatische Reisedauer-Berechnung im
// Frontend (utils/travelDuration.ts), ohne die Uhrzeit manuell ausrechnen zu müssen.
ensureColumn('travel_items', 'arrival_time', 'TEXT');
// Referenz auf einen wiederverwendbaren Ort (travel_places, siehe CREATE TABLE oben) statt erneuter
// Freitext-Eingabe je Etappe. Rein informativ/bequem: from_location/from_maps_link/from_lat/from_lng
// (bzw. die "to"-Pendants) bleiben die tatsächliche Quelle für Karte/Kalender & Co. und werden beim
// Anlegen/Bearbeiten einer Etappe aus dem gewählten Ort übernommen (siehe routes/travel.ts) – so
// funktioniert jeder bestehende Verbraucher dieser Felder unverändert weiter, ohne sie kennen zu
// müssen.
ensureColumn('travel_items', 'from_place_id', 'INTEGER REFERENCES travel_places(id) ON DELETE SET NULL');
ensureColumn('travel_items', 'to_place_id', 'INTEGER REFERENCES travel_places(id) ON DELETE SET NULL');

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
  'accommodation',
  'travel_items',
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
