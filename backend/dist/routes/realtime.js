import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { onlineUserIds, subscribe, positionsFor, updatePosition, clearPosition } from '../activity.js';
const HEARTBEAT_MS = 25_000;
// SSE statt WebSocket: Mutationen laufen weiterhin über die normalen REST-Endpunkte, hier wird nur
// server->client gebraucht (siehe activity.ts's recordActivity). EventSource schickt die
// Session-Cookie automatisch mit (Frontend: `withCredentials: true`), kein separater
// Auth-Mechanismus nötig – derselbe requireTripMember()-Gate wie bei jeder anderen Urlaub-Route.
export const realtimeRoutes = async (app) => {
    app.get('/realtime/stream', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        const tripId = Number(req.query.trip_id);
        if (!requireTripMember(reply, tripId, req.session.userId))
            return;
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
        // Initialer Snapshot bereits geteilter Standorte (Live-Standort auf der Karte, TripMap.vue) –
        // ein frisch verbindender Client bekommt so sofort die Positionen bereits aktiver Mitglieder,
        // statt erst auf deren nächsten GPS-Ping warten zu müssen.
        reply.raw.write(`event: positions\ndata: ${JSON.stringify(positionsFor(tripId))}\n\n`);
        const unsubscribe = subscribe(tripId, req.session.userId, reply);
        // Ohne periodisches Schreiben schließen manche Proxies/Browser eine lang inaktive HTTP-Verbindung
        // von sich aus – ein Kommentarzeilen-Event (":" wird von EventSource ignoriert) hält sie offen.
        const heartbeat = setInterval(() => {
            reply.raw.write(': heartbeat\n\n');
        }, HEARTBEAT_MS);
        req.raw.on('close', () => {
            clearInterval(heartbeat);
            unsubscribe();
            // Sicherheitsnetz für den Fall, dass TripMap.vue keine Gelegenheit mehr hatte, aktiv
            // DELETE /realtime/position zu senden (z. B. Tab hart geschlossen statt Route gewechselt) –
            // sonst bliebe der Standort-Marker dieses Mitglieds dauerhaft "eingefroren" auf der Karte der
            // anderen stehen.
            clearPosition(tripId, req.session.userId);
        });
    });
    // Live-Standort auf der Karte (TripMap.vue): rein ephemer (siehe activity.ts's
    // lastPositionsByTrip), bewusst KEIN recordActivity()-Aufruf – ein GPS-Ping soll weder einen
    // dauerhaften Aktivitäts-Log-Eintrag noch eine Push-Benachrichtigung auslösen. Startet, sobald
    // die Kartenansicht mountet, endet beim Unmounten (DELETE) – kein dauerhaftes
    // Hintergrund-Tracking.
    app.post('/realtime/position', async (req, reply) => {
        const { trip_id, lat, lng } = req.body ?? {};
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
            return reply.code(400).send({ error: 'lat und lng erforderlich' });
        }
        updatePosition(trip_id, req.session.userId, lat, lng);
        return reply.code(204).send();
    });
    // Querystring statt Body: api/client.ts's api.delete() sendet grundsätzlich keinen Body mit.
    app.delete('/realtime/position', async (req, reply) => {
        const tripId = req.query.trip_id;
        if (!requireTripMember(reply, tripId, req.session.userId))
            return;
        clearPosition(Number(tripId), req.session.userId);
        return reply.code(204).send();
    });
    // Standort-Freigabe unabhängig von der Kartenansicht (Nutzer-Feedback: bisher sah man andere
    // Mitglieder nur, solange diese selbst gerade die Karte offen hatten). "dauerhaft" wird als
    // Ablaufzeitpunkt weit in der Zukunft abgelegt statt eines eigenen Sonderwerts (siehe
    // db/index.ts's Kommentar zu location_share_until) - ein einzelner ">"-Vergleich reicht so
    // überall, auch clientseitig. Echtes Hintergrund-Tracking bei vollständig geschlossener PWA ist
    // mit Standard-Web-Technologie nicht erreichbar (kein Geolocation-Zugriff aus einem Service
    // Worker/nach Schließen der App, insbesondere iOS Safari/PWA) - diese Freigabe sorgt stattdessen
    // dafür, dass das Teilen unabhängig von der aktuell offenen Ansicht läuft und Neustarts der App
    // übersteht, solange sie irgendwo geöffnet ist (siehe stores/locationSharing.ts).
    const SHARE_DURATION_MS = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        forever: 50 * 365 * 24 * 60 * 60 * 1000,
    };
    app.put('/realtime/location-share', async (req, reply) => {
        const { trip_id, duration } = req.body ?? {};
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        if (duration !== 'off' && !(duration in SHARE_DURATION_MS)) {
            return reply.code(400).send({ error: 'Ungültige duration' });
        }
        const shareUntil = duration === 'off' ? null : new Date(Date.now() + SHARE_DURATION_MS[duration]).toISOString();
        db.prepare('UPDATE trip_members SET location_share_until = ? WHERE trip_id = ? AND user_id = ?').run(shareUntil, trip_id, req.session.userId);
        if (shareUntil == null)
            clearPosition(Number(trip_id), req.session.userId);
        return reply.send({ location_share_until: shareUntil });
    });
    app.get('/realtime/location-share', async (req, reply) => {
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const row = db
            .prepare('SELECT location_share_until FROM trip_members WHERE trip_id = ? AND user_id = ?')
            .get(req.query.trip_id, req.session.userId);
        return { location_share_until: row?.location_share_until ?? null };
    });
    // Nachhol-Protokoll für Clients, die beim Ändern nicht (mehr) verbunden waren (frischer
    // Seitenaufruf, Tab war geschlossen, Verbindung kurz weg) – liefert alles seit `since` nach, damit
    // Nav-Badges/Highlights auch ohne durchgehende SSE-Verbindung korrekt sind.
    app.get('/trip-activity', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const since = req.query.since ?? new Date(0).toISOString();
        return db
            .prepare('SELECT * FROM trip_activity WHERE trip_id = ? AND created_at > ? ORDER BY created_at ASC')
            .all(req.query.trip_id, since);
    });
};
