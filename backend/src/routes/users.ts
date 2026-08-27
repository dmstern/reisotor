import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { db, hasColumn, hasTable } from '../db/index.js';
import { isUserAdmin } from '../registrationConfig.js';

interface UserRow {
  id: number;
  username: string;
  email?: string | null;
  password_hash: string;
  avatar: string;
  is_admin: number;
  is_restricted: number;
  must_change_password: number;
}

interface CreateUserBody {
  username: string;
  email?: string;
  password: string;
  avatar?: string;
  is_admin?: boolean;
}

interface ToggleAdminBody {
  is_admin: boolean;
}

interface AvatarBody {
  avatar: string;
}

interface UsernameBody {
  username: string;
}

interface PasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface IconSettingsBody {
  settings: Record<string, unknown>;
}

interface AppSettingsBody {
  settings: Record<string, unknown>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users', async (req) => {
    const admin = isUserAdmin(req.session.userId);
    if (admin) {
      const rows = db
        .prepare(
          'SELECT id, username, email, avatar, is_admin, is_restricted, must_change_password FROM users ORDER BY id'
        )
        .all() as UserRow[];
      return rows.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email ?? null,
        avatar: u.avatar,
        is_admin: Boolean(u.is_admin),
        is_restricted: Boolean(u.is_restricted),
        must_change_password: Boolean(u.must_change_password),
      }));
    }
    return db.prepare('SELECT id, username, avatar FROM users ORDER BY id').all();
  });

  // Autocomplete für die Einladen-Suche (TripSwitcher.vue/TripMembersDialog.vue) – durchsucht ALLE
  // registrierten Nutzer:innen (nicht nur Mitglieder des aktuellen Urlaubs, sonst ließe sich
  // niemand Neues finden/einladen) nach Benutzername oder E-Mail. `trip_id` blendet bereits
  // eingeladene Mitglieder aus dem Ergebnis aus, damit man sie nicht versehentlich doppelt
  // vorschlägt. Mindestens 2 Zeichen, um bei jedem Tastendruck nicht die gesamte Nutzerliste
  // zurückzugeben.
  app.get<{ Querystring: { q?: string; trip_id?: string } }>('/users/search', async (req) => {
    const q = (req.query.q ?? '').trim();
    if (q.length < 2) return [];
    const like = `%${q}%`;
    const excludeTripId = req.query.trip_id ? Number(req.query.trip_id) : null;
    return db
      .prepare(
        `SELECT id, username, avatar FROM users
         WHERE (username LIKE ? OR email LIKE ?)
           AND (? IS NULL OR id NOT IN (SELECT user_id FROM trip_members WHERE trip_id = ?))
         ORDER BY username COLLATE NOCASE
         LIMIT 10`
      )
      .all(like, like, excludeTripId, excludeTripId);
  });

  // Vom Admin neu angelegte Nutzer (Issue #224): setzt must_change_password = 1, sodass die Person
  // beim ersten Login zur Passwortänderung aufgefordert wird.
  app.post<{ Body: CreateUserBody }>('/users', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply.code(403).send({ error: 'Nur Administrator:innen dürfen neue Nutzer anlegen' });
    }
    const { username, email, password, avatar, is_admin: isAdminInput } = req.body ?? {};
    if (!username?.trim() || !password) {
      return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }
    if (email?.trim() && !EMAIL_PATTERN.test(email.trim())) {
      return reply.code(400).send({ error: 'Ungültige E-Mail-Adresse' });
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email?.trim() || null;

    const existingUsername = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(trimmedUsername);
    if (existingUsername) {
      return reply.code(409).send({ error: 'Benutzername bereits vergeben' });
    }
    if (trimmedEmail) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
      if (existingEmail) {
        return reply.code(409).send({ error: 'E-Mail-Adresse wird bereits verwendet' });
      }
    }

    const hash = bcrypt.hashSync(password, 10);
    const isAdmin = isAdminInput ? 1 : 0;
    const mustChangePassword = 1;

    const result = db
      .prepare(
        'INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(trimmedUsername, trimmedEmail, hash, avatar ?? '🙂', isAdmin, mustChangePassword);
    const userId = result.lastInsertRowid as number;

    reply.code(201);
    const created = db
      .prepare(
        'SELECT id, username, email, avatar, is_admin, is_restricted, must_change_password FROM users WHERE id = ?'
      )
      .get(userId) as UserRow;
    return {
      id: created.id,
      username: created.username,
      email: created.email ?? null,
      avatar: created.avatar,
      is_admin: Boolean(created.is_admin),
      is_restricted: Boolean(created.is_restricted),
      must_change_password: Boolean(created.must_change_password),
    };
  });

  // Admin-Rolle ändern (Issue #224)
  app.put<{ Params: { id: string }; Body: ToggleAdminBody }>(
    '/users/:id/admin',
    async (req, reply) => {
      if (!isUserAdmin(req.session.userId)) {
        return reply
          .code(403)
          .send({ error: 'Nur Administrator:innen dürfen Admin-Rechte verwalten' });
      }
      const targetUserId = Number(req.params.id);
      const { is_admin: nextIsAdmin } = req.body ?? {};

      const targetUser = db
        .prepare('SELECT id, is_admin FROM users WHERE id = ?')
        .get(targetUserId) as { id: number; is_admin: number } | undefined;
      if (!targetUser) {
        return reply.code(404).send({ error: 'Nutzer nicht gefunden' });
      }

      // Schutz vor Aussperrung: Wenn man sich selbst Admin-Rechte entzieht, muss mindestens ein weiterer Admin existieren
      if (targetUserId === req.session.userId && !nextIsAdmin) {
        const adminCount = (
          db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get() as {
            count: number;
          }
        ).count;
        if (adminCount <= 1) {
          return reply.code(400).send({
            error: 'Der letzte Administrator kann sich selbst die Admin-Rechte nicht entziehen',
          });
        }
      }

      db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(
        nextIsAdmin ? 1 : 0,
        targetUserId
      );
      const updated = db
        .prepare(
          'SELECT id, username, email, avatar, is_admin, is_restricted, must_change_password FROM users WHERE id = ?'
        )
        .get(targetUserId) as UserRow;
      return {
        id: updated.id,
        username: updated.username,
        email: updated.email ?? null,
        avatar: updated.avatar,
        is_admin: Boolean(updated.is_admin),
        is_restricted: Boolean(updated.is_restricted),
        must_change_password: Boolean(updated.must_change_password),
      };
    }
  );

  // Nutzer löschen (Issue #224)
  app.delete<{ Params: { id: string } }>('/users/:id', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply.code(403).send({ error: 'Nur Administrator:innen dürfen Nutzer löschen' });
    }
    const targetUserId = Number(req.params.id);
    if (targetUserId === req.session.userId) {
      return reply.code(400).send({ error: 'Du kannst deinen eigenen Account nicht löschen' });
    }
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ?').get(targetUserId);
    if (!targetUser) {
      return reply.code(404).send({ error: 'Nutzer nicht gefunden' });
    }
    const deleteUserTx = db.transaction((id: number) => {
      const safeSetNull = (table: string, column: string) => {
        if (hasTable(table) && hasColumn(table, column)) {
          db.prepare(`UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`).run(id);
        }
      };
      const safeDelete = (table: string, column: string) => {
        if (hasTable(table) && hasColumn(table, column)) {
          db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(id);
        }
      };

      // 1. SET NULL für optionale Nutzer-Referenzen
      safeSetNull('packing_items', 'assigned_to_user_id');
      safeSetNull('packing_items', 'owner_id');
      safeSetNull('shopping_items', 'assigned_to_user_id');
      safeSetNull('todo_items', 'assigned_to_user_id');
      safeSetNull('ideas', 'created_by');
      safeSetNull('ideas', 'suggested_by_user_id');
      safeSetNull('ideas', 'paid_by_user_id');
      safeSetNull('spots', 'created_by');
      safeSetNull('spots', 'paid_by_user_id');
      safeSetNull('notes', 'created_by');
      safeSetNull('budget_items', 'paid_by_user_id');
      safeSetNull('accommodation', 'paid_by_user_id');
      safeSetNull('trip_members', 'invited_by_user_id');

      // 2. Löschen abhängiger Zeilen in Verknüpfungstabellen ohne ON DELETE CASCADE
      safeDelete('trip_members', 'user_id');
      safeDelete('trip_activity', 'actor_user_id');
      safeDelete('sessions', 'user_id');
      safeDelete('attachments', 'uploaded_by');
      safeDelete('spot_likes', 'user_id');
      safeDelete('spot_comments', 'author_id');
      safeDelete('idea_likes', 'user_id');
      safeDelete('idea_comments', 'author_id');
      safeDelete('diary_likes', 'user_id');
      safeDelete('diary_comments', 'author_id');
      safeDelete('note_likes', 'user_id');
      safeDelete('note_comments', 'author_id');
      safeDelete('diary_entries', 'author_id');
      safeDelete('diary_entry_editors', 'user_id');
      if (hasTable('budget_transfers') && hasColumn('budget_transfers', 'from_user_id')) {
        db.prepare('DELETE FROM budget_transfers WHERE from_user_id = ? OR to_user_id = ?').run(
          id,
          id
        );
      }
      safeDelete('push_subscriptions', 'user_id');
      safeDelete('push_preferences', 'user_id');
      safeDelete('drafts', 'user_id');
      safeDelete('location_tracks', 'user_id');
      safeDelete('user_icon_settings', 'user_id');

      // 3. Nutzerzeile löschen
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });

    deleteUserTx(targetUserId);
    return reply.code(204).send();
  });

  app.put<{ Body: AvatarBody }>('/users/me/avatar', async (req, reply) => {
    const { avatar } = req.body ?? {};
    if (!avatar) return reply.code(400).send({ error: 'Avatar erforderlich' });

    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.session.userId);
    return db
      .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
      .get(req.session.userId);
  });

  app.put<{ Body: UsernameBody }>('/users/me/username', async (req, reply) => {
    const { username } = req.body ?? {};
    if (!username?.trim()) return reply.code(400).send({ error: 'Benutzername erforderlich' });

    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
      .get(username.trim(), req.session.userId);
    if (existing) return reply.code(409).send({ error: 'Benutzername bereits vergeben' });

    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(
      username.trim(),
      req.session.userId
    );
    return db
      .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
      .get(req.session.userId);
  });

  app.put<{ Body: PasswordBody }>('/users/me/password', async (req, reply) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Aktuelles und neues Passwort erforderlich' });
    }
    if (newPassword.length < 6) {
      return reply.code(400).send({ error: 'Neues Passwort muss mindestens 6 Zeichen haben' });
    }

    const user = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .get(req.session.userId) as Pick<UserRow, 'id' | 'password_hash'> | undefined;

    if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
      return reply.code(401).send({ error: 'Aktuelles Passwort ist falsch' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
      hash,
      user.id
    );
    return reply.code(204).send();
  });

  // Icon-Stil-Einstellungen (#105): bisher nur in localStorage, jetzt pro Account statt pro Gerät.
  // Ein JSON-Blob statt Einzelspalten - das Frontend (stores/iconStyle.ts) lädt/speichert immer den
  // kompletten Einstellungs-Zustand auf einmal. `null` (noch nie gespeichert) liefert `{}`, damit
  // das Frontend seine lokalen Defaults anwenden kann.
  app.get('/users/me/icon-settings', async (req) => {
    const row = db
      .prepare('SELECT icon_settings FROM users WHERE id = ?')
      .get(req.session.userId) as { icon_settings: string | null } | undefined;
    if (!row?.icon_settings) return {};
    try {
      return JSON.parse(row.icon_settings);
    } catch {
      return {};
    }
  });

  app.put<{ Body: IconSettingsBody }>('/users/me/icon-settings', async (req, reply) => {
    const { settings } = req.body ?? {};
    if (!settings || typeof settings !== 'object') {
      return reply.code(400).send({ error: 'Einstellungen erforderlich' });
    }
    db.prepare('UPDATE users SET icon_settings = ? WHERE id = ?').run(
      JSON.stringify(settings),
      req.session.userId
    );
    return settings;
  });

  // App-Einstellungen (Issue #324): Persistieren aller App-Einstellungen (Theme, UI, Nav, Dashboard, etc.) pro User
  app.get('/users/me/app-settings', async (req) => {
    const row = db
      .prepare('SELECT app_settings FROM users WHERE id = ?')
      .get(req.session.userId) as { app_settings: string | null } | undefined;
    if (!row?.app_settings) return {};
    try {
      return JSON.parse(row.app_settings);
    } catch {
      return {};
    }
  });

  app.put<{ Body: AppSettingsBody }>('/users/me/app-settings', async (req, reply) => {
    const { settings } = req.body ?? {};
    if (!settings || typeof settings !== 'object') {
      return reply.code(400).send({ error: 'Einstellungen erforderlich' });
    }
    db.prepare('UPDATE users SET app_settings = ? WHERE id = ?').run(
      JSON.stringify(settings),
      req.session.userId
    );
    return settings;
  });
};
