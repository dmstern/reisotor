import bcrypt from 'bcrypt';
import { db } from './index.js';

// Falls bereits Nutzer in der Datenbank existieren (und keine expliziten SEED_USER-Env-Vars
// oder --force übergeben wurden), wird der Seed übersprungen, um bei jedem Server-Start kein
// unnötiges Bcrypt-Hashing auszuführen.
const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get();
const hasCustomEnv = Boolean(process.env.SEED_USER1 || process.env.SEED_PASS1);
const isForced = process.argv.includes('--force');

if (existingUser && !hasCustomEnv && !isForced) {
  process.exit(0);
}

const users = [
  {
    username: process.env.SEED_USER1 ?? 'user1',
    password: process.env.SEED_PASS1 ?? 'changeme1',
    avatar: process.env.SEED_AVATAR1 ?? '🧑',
  },
  {
    username: process.env.SEED_USER2 ?? 'user2',
    password: process.env.SEED_PASS2 ?? 'changeme2',
    avatar: process.env.SEED_AVATAR2 ?? '👩',
  },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, ?)'
);

for (let i = 0; i < users.length; i++) {
  const u = users[i];
  const hash = bcrypt.hashSync(u.password, 10);
  const isAdmin = i === 0 ? 1 : 0;
  const mustChangePassword = 0;
  insertUser.run(u.username, hash, u.avatar, isAdmin, mustChangePassword);
}

console.log('Seed abgeschlossen. Nutzer:', users.map((u) => u.username).join(', '));
