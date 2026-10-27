import type { FastifyPluginAsync } from 'fastify';
import { isUserAdmin } from '../registrationConfig.js';
import {
  getAllAdminSettings,
  updateAdminSettings,
  generateAndSaveVapidKeys,
  type UpdateAdminSettingsPayload,
} from '../instanceSettings.js';
import { resetTransporterForTesting } from '../utils/mailer.js';
import { ensureVapidConfigured } from '../push.js';

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
      resetTransporterForTesting();
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
};
