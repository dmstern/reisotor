import type { FastifyPluginAsync } from 'fastify';
import { getVapidPublicKey, removeSubscription, saveSubscription } from '../push.js';

// Abonnements sind pro Nutzer:in, nicht pro Urlaub – einmal aktiviert, gelten Push-Benachrichtigungen
// für alle Urlaube, an denen die Person jeweils Mitglied ist/wird (siehe push.ts's
// notifyTripMembers, das pro Urlaub über trip_members filtert).
export const pushRoutes: FastifyPluginAsync = async (app) => {
  app.get('/push/vapid-public-key', async (_req, reply) => {
    const key = getVapidPublicKey();
    if (!key) return reply.code(404).send({ error: 'Push ist auf diesem Server nicht konfiguriert' });
    return { publicKey: key };
  });

  app.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string } } }>(
    '/push/subscribe',
    async (req, reply) => {
      const { endpoint, keys } = req.body ?? {};
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.code(400).send({ error: 'Ungültiges Abonnement' });
      }
      saveSubscription(req.session.userId!, { endpoint, keys });
      reply.code(201);
      return { ok: true };
    },
  );

  // Query-Param statt Body: der geteilte api/client.ts-Wrapper unterstützt für DELETE bewusst
  // keinen Body (unüblich für simple Lösch-Requests) – ein einzelner Endpoint-String passt problemlos
  // in die URL.
  app.delete<{ Querystring: { endpoint?: string } }>('/push/subscribe', async (req, reply) => {
    const { endpoint } = req.query;
    if (!endpoint) return reply.code(400).send({ error: 'endpoint erforderlich' });
    removeSubscription(endpoint, req.session.userId!);
    return reply.code(204).send();
  });
};
