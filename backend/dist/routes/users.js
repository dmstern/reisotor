import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
export const usersRoutes = async (app) => {
    app.get('/users', async () => {
        return db.prepare('SELECT id, username, avatar FROM users ORDER BY id').all();
    });
    // Autocomplete für die Einladen-Suche (TripSwitcher.vue/TripMembersDialog.vue) – durchsucht ALLE
    // registrierten Nutzer:innen (nicht nur Mitglieder des aktuellen Urlaubs, sonst ließe sich
    // niemand Neues finden/einladen) nach Benutzername oder E-Mail. `trip_id` blendet bereits
    // eingeladene Mitglieder aus dem Ergebnis aus, damit man sie nicht versehentlich doppelt
    // vorschlägt. Mindestens 2 Zeichen, um bei jedem Tastendruck nicht die gesamte Nutzerliste
    // zurückzugeben.
    app.get('/users/search', async (req) => {
        const q = (req.query.q ?? '').trim();
        if (q.length < 2)
            return [];
        const like = `%${q}%`;
        const excludeTripId = req.query.trip_id ? Number(req.query.trip_id) : null;
        return db
            .prepare(`SELECT id, username, avatar FROM users
         WHERE (username LIKE ? OR email LIKE ?)
           AND (? IS NULL OR id NOT IN (SELECT user_id FROM trip_members WHERE trip_id = ?))
         ORDER BY username COLLATE NOCASE
         LIMIT 10`)
            .all(like, like, excludeTripId, excludeTripId);
    });
    app.post('/users', async (req, reply) => {
        const { username, password, avatar } = req.body ?? {};
        if (!username?.trim() || !password) {
            return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
        }
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existing) {
            return reply.code(409).send({ error: 'Benutzername bereits vergeben' });
        }
        const hash = bcrypt.hashSync(password, 10);
        const result = db
            .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
            .run(username.trim(), hash, avatar ?? '🙂');
        reply.code(201);
        return db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/users/me/avatar', async (req, reply) => {
        const { avatar } = req.body ?? {};
        if (!avatar)
            return reply.code(400).send({ error: 'Avatar erforderlich' });
        db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.session.userId);
        return db
            .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
            .get(req.session.userId);
    });
    app.put('/users/me/username', async (req, reply) => {
        const { username } = req.body ?? {};
        if (!username?.trim())
            return reply.code(400).send({ error: 'Benutzername erforderlich' });
        const existing = db
            .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
            .get(username.trim(), req.session.userId);
        if (existing)
            return reply.code(409).send({ error: 'Benutzername bereits vergeben' });
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username.trim(), req.session.userId);
        return db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(req.session.userId);
    });
    app.put('/users/me/password', async (req, reply) => {
        const { currentPassword, newPassword } = req.body ?? {};
        if (!currentPassword || !newPassword) {
            return reply.code(400).send({ error: 'Aktuelles und neues Passwort erforderlich' });
        }
        if (newPassword.length < 6) {
            return reply.code(400).send({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' });
        }
        const user = db
            .prepare('SELECT id, password_hash FROM users WHERE id = ?')
            .get(req.session.userId);
        if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
            return reply.code(401).send({ error: 'Aktuelles Passwort ist falsch' });
        }
        const hash = bcrypt.hashSync(newPassword, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
        return reply.code(204).send();
    });
    // Icon-Stil-Einstellungen (#105): bisher nur in localStorage, jetzt pro Account statt pro Gerät.
    // Ein JSON-Blob statt Einzelspalten - das Frontend (stores/iconStyle.ts) lädt/speichert immer den
    // kompletten Einstellungs-Zustand auf einmal. `null` (noch nie gespeichert) liefert `{}`, damit
    // das Frontend seine lokalen Defaults anwenden kann.
    app.get('/users/me/icon-settings', async (req) => {
        const row = db
            .prepare('SELECT icon_settings FROM users WHERE id = ?')
            .get(req.session.userId);
        if (!row?.icon_settings)
            return {};
        try {
            return JSON.parse(row.icon_settings);
        }
        catch {
            return {};
        }
    });
    app.put('/users/me/icon-settings', async (req, reply) => {
        const { settings } = req.body ?? {};
        if (!settings || typeof settings !== 'object') {
            return reply.code(400).send({ error: 'Einstellungen erforderlich' });
        }
        db.prepare('UPDATE users SET icon_settings = ? WHERE id = ?').run(JSON.stringify(settings), req.session.userId);
        return settings;
    });
};
