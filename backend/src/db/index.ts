import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.join(__dirname, '..', '..', 'data.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip (
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

CREATE TABLE IF NOT EXISTS spots (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  link TEXT,
  note TEXT,
  lat REAL,
  lng REAL
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

CREATE TABLE IF NOT EXISTS budget_targets (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id),
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_category_targets (
  id INTEGER PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_transfers (
  id INTEGER PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL,
  date TEXT,
  note TEXT
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id INTEGER PRIMARY KEY,
  label TEXT NOT NULL,
  assigned_to_user_id INTEGER REFERENCES users(id),
  checked INTEGER DEFAULT 0,
  note TEXT
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
ensureColumn('accommodation', 'amount', 'REAL');
ensureColumn('accommodation', 'paid_by_user_id', 'INTEGER REFERENCES users(id)');
ensureColumn('accommodation', 'budget_expense_id', 'INTEGER REFERENCES budget_items(id)');

const DEFAULT_BUDGET_CATEGORIES = [
  'Essen & Trinken',
  'Unterkunft',
  'Transport',
  'Aktivitäten & Spaß',
  'Souvenirs',
  'Sonstiges',
];
const insertCategoryTarget = db.prepare(
  'INSERT OR IGNORE INTO budget_category_targets (category, amount) VALUES (?, 0)',
);
for (const category of DEFAULT_BUDGET_CATEGORIES) {
  insertCategoryTarget.run(category);
}
