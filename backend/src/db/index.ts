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
  link TEXT,
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
ensureColumn('schedule_items', 'end_date', 'TEXT');
ensureColumn('schedule_items', 'location', 'TEXT');
ensureColumn('schedule_items', 'maps_link', 'TEXT');
ensureColumn('schedule_items', 'lat', 'REAL');
ensureColumn('schedule_items', 'lng', 'REAL');
ensureColumn('schedule_items', 'category', "TEXT DEFAULT 'other'");
ensureColumn('trips', 'maps_link', 'TEXT');
ensureColumn('trips', 'lat', 'REAL');
ensureColumn('trips', 'lng', 'REAL');
ensureColumn('budget_items', 'budget_id', 'INTEGER REFERENCES budgets(id) ON DELETE SET NULL');

// Spots als eigenständiges Konzept wurden zugunsten einer reinen Kartenansicht (Batch 4)
// wieder entfernt – Karte zeigt seitdem nur noch Urlaub/Ausflüge/Unterkunft mit Koordinaten.
db.exec('DROP TABLE IF EXISTS spots');

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

const DEFAULT_BUDGET_CATEGORIES = [
  'Essen & Trinken',
  'Unterkunft',
  'Transport',
  'Aktivitäten & Spaß',
  'Souvenirs',
  'Sonstiges',
];

/** Legt für einen Urlaub das Standard-"Gemeinsame Budget" mit den Standardkategorien an,
 *  sofern noch kein geteiltes Budget existiert. */
export function ensureDefaultSharedBudget(tripId: number) {
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
for (const trip of allTrips) {
  ensureDefaultSharedBudget(trip.id);
}
