import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import {
  REGISTRATION_MODE,
  isUserRestricted,
  isUserAdmin,
  userMustChangePassword,
  isUsernameFullAccess,
} from '../registrationConfig.js';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  avatar: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Frontend braucht den Modus schon VOR dem Login, um den Registrieren-Umschalter auf der
  // Login-Seite (LoginView.vue) überhaupt anzuzeigen – bewusst ungeschützt wie der Rest von /auth/*.
  app.get('/config', async () => {
    return { registrationMode: REGISTRATION_MODE };
  });

  // Selbstregistrierung auf der Login-Seite (LoginView.vue) – zusätzlich zum bestehenden, aus dem
  // Profil heraus erreichbaren "Nutzer anlegen" (routes/users.ts, POST /users, braucht bereits
  // eine eingeloggte Session). Loggt direkt ein (wie /login), damit die Registrierung nicht als
  // separater zweiter Schritt erscheint. Registrierte Nutzer:innen treten dabei bewusst KEINEM
  // bestehenden Urlaub bei (siehe db/index.ts's trip_members-Backfill-Kommentar) – ein neuer
  // Urlaub oder eine Einladung ist der einzige Weg zu einem sichtbaren Urlaub.
  app.post<{ Body: { username: string; email: string; password: string } }>(
    '/register',
    async (req, reply) => {
      if (REGISTRATION_MODE === 'off') {
        return reply.code(403).send({ error: 'Registrierung ist aktuell deaktiviert' });
      }
      const { username, email, password } = req.body ?? {};
      if (!username?.trim() || !email?.trim() || !password) {
        return reply.code(400).send({ error: 'Benutzername, E-Mail und Passwort erforderlich' });
      }
      if (!EMAIL_PATTERN.test(email.trim())) {
        return reply.code(400).send({ error: 'Ungültige E-Mail-Adresse' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Passwort muss mindestens 6 Zeichen haben' });
      }

      const existingUsername = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(username.trim());
      if (existingUsername) {
        return reply.code(409).send({ error: 'Benutzername bereits vergeben' });
      }
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
      if (existingEmail) {
        return reply.code(409).send({ error: 'E-Mail-Adresse wird bereits verwendet' });
      }

      const trimmedUsername = username.trim();
      const restricted =
        REGISTRATION_MODE === 'restricted' && !isUsernameFullAccess(trimmedUsername) ? 1 : 0;

      // Der allererste Nutzer in der Datenbank wird automatisch Admin.
      const userCount = (
        db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
      ).count;
      const isAdmin = userCount === 0 ? 1 : 0;

      const hash = bcrypt.hashSync(password, 10);
      const result = db
        .prepare(
          'INSERT INTO users (username, email, password_hash, avatar, is_restricted, is_admin, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 0)'
        )
        .run(trimmedUsername, email.trim(), hash, '🙂', restricted, isAdmin);
      const userId = result.lastInsertRowid as number;

      req.session.userId = userId;
      req.session.username = trimmedUsername;
      reply.code(201);
      return {
        id: userId,
        username: trimmedUsername,
        avatar: '🙂',
        restricted: isUserRestricted(userId),
        is_admin: Boolean(isAdmin),
        must_change_password: false,
      };
    }
  );

  app.post<{ Body: { username: string; password: string } }>('/login', async (req, reply) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = db
      .prepare('SELECT id, username, password_hash, avatar FROM users WHERE username = ?')
      .get(username) as UserRow | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Ungültige Anmeldedaten' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      restricted: isUserRestricted(user.id),
      is_admin: isUserAdmin(user.id),
      must_change_password: userMustChangePassword(user.id),
    };
  });

  app.post('/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.code(204).send();
  });

  app.get('/me', async (req, reply) => {
    if (!req.session.userId) {
      return reply.code(401).send({ error: 'Nicht eingeloggt' });
    }
    const user = db
      .prepare('SELECT id, username, avatar FROM users WHERE id = ?')
      .get(req.session.userId) as Pick<UserRow, 'id' | 'username' | 'avatar'> | undefined;
    if (!user) {
      return reply.code(401).send({ error: 'Nicht eingeloggt' });
    }
    return {
      ...user,
      restricted: isUserRestricted(user.id),
      is_admin: isUserAdmin(user.id),
      must_change_password: userMustChangePassword(user.id),
    };
  });
};
