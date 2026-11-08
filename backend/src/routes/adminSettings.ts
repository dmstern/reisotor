import type { FastifyPluginAsync } from 'fastify';
import { isUserAdmin } from '../registrationConfig.js';
import { db } from '../db/index.js';
import {
  getAllAdminSettings,
  updateAdminSettings,
  generateAndSaveVapidKeys,
  type UpdateAdminSettingsPayload,
} from '../instanceSettings.js';
import { resetTransporter, isEmailConfigured, sendTestEmail } from '../utils/mailer.js';
import { ensureVapidConfigured, sendVersionNotification } from '../push.js';
import { readBuildInfo } from './buildInfo.js';
import { EMAIL_PATTERN } from './auth.js';
import { broadcastToAdmins } from '../activity.js';

export const adminSettingsRoutes: FastifyPluginAsync = async (app) => {
  // Alle Einstellungen für Admins abrufen
  app.get('/admin/settings', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Systemeinstellungen einsehen' });
    }

    return { settings: getAllAdminSettings() };
  });

  // Einstellungen aktualisieren
  app.put<{ Body: UpdateAdminSettingsPayload }>('/admin/settings', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Systemeinstellungen ändern' });
    }

    const updated = updateAdminSettings(req.body ?? {});

    // Cache/Instanzen bei Bedarf zurücksetzen
    if (req.body?.email) {
      resetTransporter();
    }

    if (req.body?.push) {
      ensureVapidConfigured();
    }

    return { settings: updated };
  });

  // Neue VAPID-Schlüssel für Web Push generieren
  app.post<{ Body?: { subject?: string } }>(
    '/admin/settings/vapid-generate',
    async (req, reply) => {
      if (!isUserAdmin(req.session.userId)) {
        return reply
          .code(403)
          .send({ error: 'Nur Administrator:innen dürfen Push-Schlüssel generieren' });
      }

      const result = generateAndSaveVapidKeys(req.body?.subject);
      ensureVapidConfigured();
      return result;
    }
  );

  // Push-Benachrichtigung für neue Version manuell auslösen (nur Admins)
  app.post<{ Body?: { version?: string; detail?: string } }>(
    '/admin/settings/send-version-push',
    async (req, reply) => {
      if (!isUserAdmin(req.session.userId)) {
        return reply
          .code(403)
          .send({ error: 'Nur Administrator:innen dürfen Versions-Pushs versenden' });
      }

      if (!ensureVapidConfigured()) {
        return reply.code(400).send({ error: 'Push ist auf diesem Server nicht konfiguriert' });
      }

      const info = readBuildInfo();
      const version = req.body?.version?.trim() || info.version || 'Update';
      const detail = req.body?.detail?.trim() || info.changelog?.notes?.[0];
      await sendVersionNotification(version, detail);
      return { ok: true, version };
    }
  );

  // Test-E-Mail senden (nur Admins)
  app.post<{ Body?: { to?: string } }>('/admin/settings/send-test-email', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Test-E-Mails versenden' });
    }

    if (!isEmailConfigured()) {
      return reply.code(400).send({ error: 'SMTP-Server ist nicht konfiguriert' });
    }

    let targetEmail = req.body?.to?.trim();

    if (targetEmail) {
      if (!EMAIL_PATTERN.test(targetEmail)) {
        return reply.code(400).send({
          error: 'Die angegebene Empfänger-E-Mail-Adresse ist ungültig',
        });
      }
    } else {
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId) as
        { email: string | null } | undefined;
      targetEmail = user?.email?.trim();

      if (!targetEmail || !EMAIL_PATTERN.test(targetEmail)) {
        return reply.code(400).send({
          error:
            'In deinem Benutzerprofil ist keine E-Mail-Adresse hinterlegt. Bitte trage zuerst eine E-Mail-Adresse in deinem Profil ein.',
        });
      }
    }

    const result = await sendTestEmail({ to: targetEmail });

    if (!result.success) {
      let errorDetail = result.error || 'Verbindung zum SMTP-Server fehlgeschlagen';

      if (errorDetail.toLowerCase().includes('timeout')) {
        errorDetail +=
          ' (Tipp: Viele Cloud-Hoster wie Netcup oder Hetzner blockieren Port 587/465. Versuche Port 2525 oder prüfe die externe Firewall deines Hosters)';
      }

      return reply.code(502).send({
        error: `Fehler beim Versenden der Test-E-Mail: ${errorDetail}`,
      });
    }

    return {
      success: true,
      message: `Test-E-Mail wurde erfolgreich an ${targetEmail} gesendet!`,
    };
  });

  // Admin-Nachrichten / Kontaktanfragen abrufen
  app.get('/admin/messages', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Admin-Nachrichten einsehen' });
    }

    const rows = db
      .prepare(
        `SELECT m.id, m.type, m.name, m.email, m.username, m.message, m.status, m.created_at,
                u.id AS matched_user_id, u.username AS matched_username, u.is_email_verified AS matched_is_email_verified
         FROM admin_messages m
         LEFT JOIN users u ON (m.username IS NOT NULL AND LOWER(u.username) = LOWER(m.username))
                           OR (m.email IS NOT NULL AND LOWER(u.email) = LOWER(m.email))
         GROUP BY m.id
         ORDER BY CASE WHEN m.status = 'unread' THEN 0 ELSE 1 END, m.created_at DESC
         LIMIT 100`
      )
      .all() as Array<{
      id: number;
      type: string;
      name: string | null;
      email: string | null;
      username: string | null;
      message: string;
      status: string;
      created_at: string;
      matched_user_id?: number | null;
      matched_username?: string | null;
      matched_is_email_verified?: number | null;
    }>;

    const unreadCount = (
      db.prepare("SELECT COUNT(*) as count FROM admin_messages WHERE status = 'unread'").get() as {
        count: number;
      }
    ).count;

    return {
      messages: rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        email: row.email,
        username: row.username,
        message: row.message,
        status: row.status,
        created_at: row.created_at,
        matchedUser: row.matched_user_id
          ? {
              id: row.matched_user_id,
              username: row.matched_username,
              is_email_verified: row.matched_is_email_verified === 1,
            }
          : null,
      })),
      unreadCount,
    };
  });

  // Status einer Admin-Nachricht aktualisieren (z. B. 'read' oder 'resolved')
  app.put<{ Params: { id: string }; Body: { status: 'unread' | 'read' | 'resolved' } }>(
    '/admin/messages/:id/status',
    async (req, reply) => {
      if (!isUserAdmin(req.session.userId)) {
        return reply
          .code(403)
          .send({ error: 'Nur Administrator:innen dürfen Admin-Nachrichten bearbeiten' });
      }

      const { status } = req.body ?? {};

      if (!status || !['unread', 'read', 'resolved'].includes(status)) {
        return reply.code(400).send({ error: 'Ungültiger Status' });
      }

      db.prepare('UPDATE admin_messages SET status = ? WHERE id = ?').run(
        status,
        Number(req.params.id)
      );

      const unreadCount = (
        db
          .prepare("SELECT COUNT(*) as count FROM admin_messages WHERE status = 'unread'")
          .get() as {
          count: number;
        }
      ).count;
      broadcastToAdmins('admin_message', { unreadCount });

      return { success: true };
    }
  );

  // Admin-Nachricht löschen
  app.delete<{ Params: { id: string } }>('/admin/messages/:id', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply
        .code(403)
        .send({ error: 'Nur Administrator:innen dürfen Admin-Nachrichten löschen' });
    }

    db.prepare('DELETE FROM admin_messages WHERE id = ?').run(Number(req.params.id));

    const unreadCount = (
      db.prepare("SELECT COUNT(*) as count FROM admin_messages WHERE status = 'unread'").get() as {
        count: number;
      }
    ).count;
    broadcastToAdmins('admin_message', { unreadCount });

    return reply.code(204).send();
  });
};
