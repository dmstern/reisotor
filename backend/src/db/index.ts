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
`);

// Additive Migrationen (idempotent): erlaubt, das Schema weiterzuentwickeln,
// ohne bestehende Daten in data.sqlite zu verlieren.
function ensureColumn(table: string, column: string, definition: string) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!existing.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
