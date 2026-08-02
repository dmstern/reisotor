import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { onlineUserIds, subscribe } from '../activity.js';

const HEARTBEAT_MS = 25_000;

// SSE statt WebSocket: Mutationen laufen weiterhin über die normalen REST-Endpunkte, hier wird nur
// server->client gebraucht (siehe activity.ts's recordActivity). EventSource schickt die
// Session-Cookie automatisch mit (Frontend: `withCredentials: true`), kein separater
// Auth-Mechanismus nötig – derselbe requireTripMember()-Gate wie bei jeder anderen Urlaub-Route.
export const realtimeRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/realtime/stream', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    const tripId = Number(req.query.trip_id);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    // Fastify soll nach dieser Route nichts mehr selbst an die Antwort schreiben/sie beenden – die
    // Verbindung bleibt bewusst offen, bis der Client trennt (req.raw 'close' unten).
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Reverse-Proxies (Caddy) puffern Antworten sonst teils, bevor SSE-Chunks beim Client ankommen.
      'X-Accel-Buffering': 'no',
    });
    reply.raw.write(`event: presence\ndata: ${JSON.stringify({ online: onlineUserIds(tripId) })}\n\n`);

    const unsubscribe = subscribe(tripId, req.session.userId!, reply);
    // Ohne periodisches Schreiben schließen manche Proxies/Browser eine lang inaktive HTTP-Verbindung
    // von sich aus – ein Kommentarzeilen-Event (":" wird von EventSource ignoriert) hält sie offen.
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // Nachhol-Protokoll für Clients, die beim Ändern nicht (mehr) verbunden waren (frischer
  // Seitenaufruf, Tab war geschlossen, Verbindung kurz weg) – liefert alles seit `since` nach, damit
  // Nav-Badges/Highlights auch ohne durchgehende SSE-Verbindung korrekt sind.
  app.get<{ Querystring: { trip_id?: string; since?: string } }>('/trip-activity', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const since = req.query.since ?? new Date(0).toISOString();
    return db
      .prepare('SELECT * FROM trip_activity WHERE trip_id = ? AND created_at > ? ORDER BY created_at ASC')
      .all(req.query.trip_id, since);
  });
};
