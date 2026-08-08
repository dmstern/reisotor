import bcrypt from 'bcrypt';
import { db } from './index.js';
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
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, avatar) VALUES (?, ?, ?)');
for (const u of users) {
    const hash = bcrypt.hashSync(u.password, 10);
    insertUser.run(u.username, hash, u.avatar);
}
console.log('Seed abgeschlossen. Nutzer:', users.map((u) => u.username).join(', '));
