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
      return reply.code(502).send({
        error: `Fehler beim Versenden der Test-E-Mail: ${result.error || 'Verbindung zum SMTP-Server fehlgeschlagen'}`,
      });
    }

    return {
      success: true,
      message: `Test-E-Mail wurde erfolgreich an ${targetEmail} gesendet!`,
    };
  });
};
