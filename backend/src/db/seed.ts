import bcrypt from 'bcrypt';
import { db } from './index.js';

const users = [
  { username: process.env.SEED_USER1 ?? 'user1', password: process.env.SEED_PASS1 ?? 'changeme1' },
  { username: process.env.SEED_USER2 ?? 'user2', password: process.env.SEED_PASS2 ?? 'changeme2' },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)',
);

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.username, hash);
}

db.prepare(
  `INSERT OR IGNORE INTO trip (id, name, destination, start_date, end_date) VALUES (1, ?, ?, ?, ?)`,
).run('Unsere Reise', '', new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10));

db.prepare(
  `INSERT OR IGNORE INTO accommodation (id, name, address, link, checkin, checkout, contact, note, lat, lng)
   VALUES (1, '', '', '', '', '', '', '', NULL, NULL)`,
).run();

console.log('Seed abgeschlossen. Nutzer:', users.map((u) => u.username).join(', '));
