import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { db, hasTable, hasColumn } from '../db/index.js';
import {
  getRegistrationMode,
  isUserRestricted,
  isUserAdmin,
  userMustChangePassword,
  isUsernameFullAccess,
  isUserEmailVerified,
} from '../registrationConfig.js';
import {
  isEmailConfigured,
  isEmailVerificationRequired,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendAdminContactNotificationEmail,
} from '../utils/mailer.js';
import { isContactAdminEnabled } from '../instanceSettings.js';
import { broadcastToAdmins } from '../activity.js';
import { sendPushToAdmins } from '../push.js';
import { checkFeedbackRateLimit } from '../utils/feedbackRateLimiter.js';

interface UserRow {
  id: number;
  username: string;
  email?: string | null;
  password_hash: string;
  avatar: string;
  is_email_verified?: number;
  last_login_at?: string | null;
  is_locked?: number;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const authRoutes: FastifyPluginAsync = async (app) => {
  // Frontend braucht den Modus schon VOR dem Login, um den Registrieren-Umschalter auf der
  // Login-Seite (LoginView.vue) überhaupt anzuzeigen – bewusst ungeschützt wie der Rest von /auth/*.
  app.get('/config', async () => {
    return {
      registrationMode: getRegistrationMode(),
      emailConfigured: isEmailConfigured(),
      requireEmailVerification: isEmailVerificationRequired(),
      contactAdminEnabled: isContactAdminEnabled(),
    };
  });

  // Selbstregistrierung auf der Login-Seite (LoginView.vue)
  app.post<{ Body: { username: string; email: string; password: string } }>(
    '/register',
    async (req, reply) => {
      const mode = getRegistrationMode();
      if (mode === 'off') {
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

      // Der allererste Nutzer in der Datenbank wird automatisch Admin und erhält immer Vollzugriff.
      const userCount = (
        db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
      ).count;
      const isAdmin = userCount === 0 ? 1 : 0;

      const trimmedUsername = username.trim();
      const trimmedEmail = email.trim();
      const restricted =
        isAdmin || isUsernameFullAccess(trimmedUsername) || mode !== 'restricted' ? 0 : 1;

      const requireVerification = isEmailVerificationRequired() && !isAdmin;
      const isEmailVerified = requireVerification ? 0 : 1;

      const hash = bcrypt.hashSync(password, 10);
      const result = db
        .prepare(
          'INSERT INTO users (username, email, password_hash, avatar, is_restricted, is_admin, must_change_password, is_email_verified) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
        )
        .run(trimmedUsername, trimmedEmail, hash, '🙂', restricted, isAdmin, isEmailVerified);
      const userId = result.lastInsertRowid as number;

      if (requireVerification) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        db.prepare(
          'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
        ).run(userId, tokenHash, expiresAt, new Date().toISOString());

        const mailResult = await sendVerificationEmail({
          to: trimmedEmail,
          username: trimmedUsername,
          token: rawToken,
        });

        if (!mailResult.success) {
          // Rollback: Angelegten User und Verifizierungs-Token entfernen,
          // damit kein blockierter Orphan-Account entsteht
          db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(userId);
          db.prepare('DELETE FROM users WHERE id = ?').run(userId);

          const errorMessage = !isEmailConfigured()
            ? 'Die Registrierung kann derzeit nicht abgeschlossen werden, da kein E-Mail-Server konfiguriert ist. Bitte wende dich an die Administration.'
            : 'Die Bestätigungs-E-Mail konnte nicht zugestellt werden. Bitte überprüfe deine E-Mail-Adresse oder wende dich an die Administration.';

          return reply.code(503).send({
            error: errorMessage,
            noMailServer: !isEmailConfigured(),
          });
        }

        reply.code(201);
        return {
          id: userId,
          username: trimmedUsername,
          requiresVerification: true,
          message:
            'Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir per E-Mail gesendet haben.',
        };
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, userId);

      req.session.userId = userId;
      req.session.username = trimmedUsername;
      reply.code(201);
      return {
        id: userId,
        username: trimmedUsername,
        email: trimmedEmail,
        avatar: '🙂',
        restricted: isUserRestricted(userId),
        is_admin: Boolean(isAdmin),
        must_change_password: false,
        is_email_verified: true,
        last_login_at: now,
      };
    }
  );

  // E-Mail-Bestätigung (Double-Opt-In)
  app.post<{ Body: { token: string } }>('/verify-email', async (req, reply) => {
    const { token } = req.body ?? {};
    if (!token?.trim()) {
      return reply.code(400).send({ error: 'Bestätigungs-Token erforderlich' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const record = db
      .prepare(
        'SELECT id, user_id, pending_email, expires_at FROM email_verification_tokens WHERE token_hash = ?'
      )
      .get(tokenHash) as
      | { id: number; user_id: number; pending_email?: string | null; expires_at: string }
      | undefined;

    if (!record) {
      return reply.code(400).send({ error: 'Ungültiger oder abgelaufener Bestätigungslink' });
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM email_verification_tokens WHERE id = ?').run(record.id);
      return reply
        .code(400)
        .send({ error: 'Bestätigungslink ist abgelaufen. Bitte fordere einen neuen an.' });
    }

    if (record.pending_email) {
      const existing = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?')
        .get(record.pending_email, record.user_id);
      if (existing) {
        db.prepare('DELETE FROM email_verification_tokens WHERE id = ?').run(record.id);
        return reply.code(409).send({
          error: 'Diese E-Mail-Adresse wird inzwischen von einem anderen Konto verwendet.',
        });
      }
      db.prepare('UPDATE users SET email = ?, is_email_verified = 1 WHERE id = ?').run(
        record.pending_email,
        record.user_id
      );
    } else {
      db.prepare('UPDATE users SET is_email_verified = 1 WHERE id = ?').run(record.user_id);
    }
    db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(record.user_id);

    return {
      success: true,
      message: 'E-Mail-Adresse erfolgreich bestätigt!',
    };
  });

  // Passwort-Reset anfordern ("Passwort vergessen?")
  app.post<{ Body: { email: string } }>('/forgot-password', async (req, reply) => {
    const { email } = req.body ?? {};
    if (!email?.trim() || !EMAIL_PATTERN.test(email.trim())) {
      return reply.code(400).send({ error: 'Gültige E-Mail-Adresse erforderlich' });
    }

    const user = db
      .prepare('SELECT id, username, email, is_locked FROM users WHERE LOWER(email) = LOWER(?)')
      .get(email.trim()) as
      { id: number; username: string; email: string; is_locked: number } | undefined;

    if (user && !user.is_locked) {
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
      ).run(user.id, tokenHash, expiresAt, new Date().toISOString());

      await sendPasswordResetEmail({
        to: user.email,
        username: user.username,
        token: rawToken,
      });
    }

    // Immer gleiche Erfolgsmeldung zurückgeben, um User Enumeration zu verhindern
    return {
      message:
        'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail mit einem Link zum Zurücksetzen des Passworts versendet.',
    };
  });

  // Passwort mit Token zurücksetzen
  app.post<{ Body: { token: string; newPassword: string } }>(
    '/reset-password',
    async (req, reply) => {
      const { token, newPassword } = req.body ?? {};
      if (!token?.trim()) {
        return reply.code(400).send({ error: 'Token erforderlich' });
      }
      if (!newPassword || newPassword.length < 6) {
        return reply.code(400).send({ error: 'Das neue Passwort muss mindestens 6 Zeichen haben' });
      }

      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const record = db
        .prepare('SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?')
        .get(tokenHash) as { id: number; user_id: number; expires_at: string } | undefined;

      if (!record) {
        return reply
          .code(400)
          .send({ error: 'Ungültiger oder abgelaufener Link zum Zurücksetzen' });
      }

      if (new Date(record.expires_at).getTime() < Date.now()) {
        db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(record.id);
        return reply.code(400).send({
          error: 'Der Link zum Zurücksetzen ist abgelaufen. Bitte fordere einen neuen an.',
        });
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
        hash,
        record.user_id
      );
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(record.user_id);

      // Bestehende Sessions für den Nutzer invalidieren
      if (hasTable('sessions') && hasColumn('sessions', 'user_id')) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(record.user_id);
      }

      return {
        success: true,
        message:
          'Passwort erfolgreich geändert! Du kannst dich jetzt mit deinem neuen Passwort anmelden.',
      };
    }
  );

  app.post<{ Body: { username: string; password: string } }>('/login', async (req, reply) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      return reply.code(400).send({ error: 'Benutzername und Passwort erforderlich' });
    }

    const user = db
      .prepare(
        'SELECT id, username, email, password_hash, avatar, is_email_verified, is_locked FROM users WHERE username = ?'
      )
      .get(username) as (UserRow & { is_email_verified: number; is_locked: number }) | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Ungültige Anmeldedaten' });
    }

    if (user.is_locked) {
      return reply.code(403).send({
        error: 'Dieses Benutzerkonto ist gesperrt. Bitte wende dich an die Administration.',
      });
    }

    if (isEmailVerificationRequired() && user.is_email_verified === 0) {
      const errorMsg = !isEmailConfigured()
        ? 'Dieses Konto ist noch nicht freigeschaltet. Da kein Mailserver eingerichtet ist, muss dein Konto manuell von der Administration freigeschaltet werden.'
        : 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.';
      return reply.code(403).send({
        error: errorMsg,
        unverifiedEmail: true,
        noMailServer: !isEmailConfigured(),
      });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now, user.id);

    req.session.userId = user.id;
    req.session.username = user.username;

    const pendingToken = db
      .prepare(
        'SELECT pending_email FROM email_verification_tokens WHERE user_id = ? AND expires_at > ? ORDER BY id DESC LIMIT 1'
      )
      .get(user.id, now) as { pending_email: string | null } | undefined;

    return {
      id: user.id,
      username: user.username,
      email: user.email ?? null,
      pending_email: pendingToken?.pending_email ?? null,
      avatar: user.avatar,
      restricted: isUserRestricted(user.id),
      is_admin: isUserAdmin(user.id),
      must_change_password: userMustChangePassword(user.id),
      is_email_verified: isUserEmailVerified(user.id),
      last_login_at: now,
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
      .prepare(
        'SELECT id, username, email, avatar, last_login_at, is_locked FROM users WHERE id = ?'
      )
      .get(req.session.userId) as
      | Pick<UserRow, 'id' | 'username' | 'email' | 'avatar' | 'last_login_at' | 'is_locked'>
      | undefined;
    if (!user) {
      return reply.code(401).send({ error: 'Nicht eingeloggt' });
    }

    if (user.is_locked) {
      await req.session.destroy();
      return reply.code(403).send({ error: 'Dieses Benutzerkonto ist gesperrt.' });
    }

    const pendingToken = db
      .prepare(
        'SELECT pending_email FROM email_verification_tokens WHERE user_id = ? AND expires_at > ? ORDER BY id DESC LIMIT 1'
      )
      .get(user.id, new Date().toISOString()) as { pending_email: string | null } | undefined;

    return {
      ...user,
      email: user.email ?? null,
      pending_email: pendingToken?.pending_email ?? null,
      restricted: isUserRestricted(user.id),
      is_admin: isUserAdmin(user.id),
      must_change_password: userMustChangePassword(user.id),
      is_email_verified: isUserEmailVerified(user.id),
      last_login_at: user.last_login_at ?? null,
    };
  });

  // Kontaktanfrage / Registrierungshilfe an die Administration
  app.post<{
    Body: { name?: string; email?: string; username?: string; message: string; type?: string };
  }>('/contact-admin', async (req, reply) => {
    if (!isContactAdminEnabled()) {
      return reply.code(403).send({
        error: 'Die Kontaktfunktion für Administrator:innen ist aktuell deaktiviert.',
      });
    }

    const { name, email, username, message, type = 'registration_help' } = req.body ?? {};
    if (!message || message.trim().length < 5) {
      return reply
        .code(400)
        .send({ error: 'Bitte gib eine aussagekräftige Nachricht ein (mind. 5 Zeichen).' });
    }
    if (message.length > 2000) {
      return reply.code(400).send({ error: 'Die Nachricht darf maximal 2000 Zeichen lang sein.' });
    }
    if (email && email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      return reply.code(400).send({ error: 'Ungültiges E-Mail-Format.' });
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    // Rate-Limiting: Max. 3 Nachrichten innerhalb von 1 Stunde pro IP und/oder Cookie
    let contactToken = req.cookies?.contact_rate_limit;
    if (
      !contactToken ||
      typeof contactToken !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactToken)
    ) {
      contactToken = crypto.randomUUID();
    }
    reply.setCookie('contact_rate_limit', contactToken, {
      path: '/',
      httpOnly: true,
      maxAge: 3600,
      sameSite: 'lax',
    });

    const cookieCheck = checkFeedbackRateLimit(
      `contact_admin:cookie:${contactToken}`,
      3,
      60 * 60 * 1000
    );
    const ipCheck = checkFeedbackRateLimit(`contact_admin:ip:${clientIp}`, 3, 60 * 60 * 1000);

    if (!cookieCheck.allowed || !ipCheck.allowed) {
      return reply.code(429).send({
        error:
          'Zu viele Anfragen. Du kannst maximal 3 Nachrichten innerhalb einer Stunde senden. Bitte versuche es später erneut.',
      });
    }

    const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 16);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO admin_messages (type, name, email, username, message, status, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, 'unread', ?, ?)`
    ).run(
      type.substring(0, 50),
      name?.trim().substring(0, 100) || null,
      email?.trim().substring(0, 200) || null,
      username?.trim().substring(0, 100) || null,
      message.trim(),
      ipHash,
      now
    );

    // LiveSync-Ereignis an aktive Admins broadcasten
    const unreadCount = (
      db.prepare("SELECT COUNT(*) as count FROM admin_messages WHERE status = 'unread'").get() as {
        count: number;
      }
    ).count;
    broadcastToAdmins('admin_message', { unreadCount });

    // Web-Push an Admins senden
    sendPushToAdmins({
      title: 'Reisotor – Kontaktanfrage',
      body: `Hilfegesuch von ${name?.trim() || username?.trim() || 'einem Nutzer'}`,
      url: '/settings?tab=admin#admin-messages',
    }).catch(() => {});

    // E-Mail-Benachrichtigung an Administrator:innen mit hinterlegter E-Mail-Adresse
    if (isEmailConfigured()) {
      const adminUsers = db
        .prepare(
          "SELECT id, username, email FROM users WHERE is_admin = 1 AND email IS NOT NULL AND trim(email) != ''"
        )
        .all() as Array<{ id: number; username: string; email: string }>;

      for (const admin of adminUsers) {
        if (admin.email && EMAIL_PATTERN.test(admin.email.trim())) {
          sendAdminContactNotificationEmail({
            to: admin.email.trim(),
            adminUsername: admin.username,
            senderName: name?.trim() || null,
            senderEmail: email?.trim() || null,
            senderUsername: username?.trim() || null,
            message: message.trim(),
            type,
          }).catch((err) => {
            console.error('[Mailer] Fehler beim Versenden der Admin-Kontakt-E-Mail:', err);
          });
        }
      }
    }

    return {
      success: true,
      message: 'Deine Nachricht wurde an die Administration übermittelt.',
    };
  });
};
