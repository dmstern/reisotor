import type { FastifyReply } from 'fastify';
import { db } from './db/index.js';
import { notifyTripMembers } from './push.js';

interface SseConnection {
  reply: FastifyReply;
  userId: number;
}

// In-Memory statt in der DB: Verbindungen sind pro Prozess flüchtig (überleben keinen Neustart,
// brauchen es auch nicht – ein neu verbindender Client bekommt seinen aktuellen Stand ohnehin über
// GET /trip-activity?since= nachgeliefert, siehe routes/realtime.ts).
const connectionsByTrip = new Map<number, Set<SseConnection>>();

function writeEvent(reply: FastifyReply, event: string, data: unknown) {
  try {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Verbindung ist zwischen Broadcast und Schreibversuch schon weg (Race mit dem close-Handler in
    // routes/realtime.ts) – kein Fehlerfall, der nächste Broadcast trifft diese Connection ohnehin
    // nicht mehr (sie wurde beim close bereits aus dem Set entfernt).
  }
}

export function onlineUserIds(tripId: number): number[] {
  const set = connectionsByTrip.get(tripId);
  if (!set) return [];
  return [...new Set([...set].map((c) => c.userId))];
}

function broadcastPresence(tripId: number) {
  const set = connectionsByTrip.get(tripId);
  if (!set) return;
  const online = onlineUserIds(tripId);
  for (const conn of set) writeEvent(conn.reply, 'presence', { online });
}

/** Registriert eine offene SSE-Verbindung für einen Urlaub/eine Session (routes/realtime.ts ruft das
 *  direkt nach dem Öffnen des Streams auf) und broadcastet den neuen Online-Stand an alle Mitglieder
 *  desselben Urlaubs (Präsenzanzeige im Header, ähnlich Google Docs). Gibt eine Unsubscribe-Funktion
 *  zurück, die beim Verbindungsabbau (req.raw 'close') aufgerufen werden muss. */
export function subscribe(tripId: number, userId: number, reply: FastifyReply): () => void {
  const conn: SseConnection = { reply, userId };
  let set = connectionsByTrip.get(tripId);
  if (!set) {
    set = new Set();
    connectionsByTrip.set(tripId, set);
  }
  set.add(conn);
  broadcastPresence(tripId);

  return () => {
    set!.delete(conn);
    if (set!.size === 0) connectionsByTrip.delete(tripId);
    broadcastPresence(tripId);
  };
}

interface ActivityRow {
  id: number;
  trip_id: number;
  domain: string;
  entity_id: number | null;
  action: string;
  actor_user_id: number;
  created_at: string;
}

function broadcastActivity(tripId: number, row: ActivityRow) {
  const set = connectionsByTrip.get(tripId);
  if (!set) return;
  for (const conn of set) writeEvent(conn.reply, 'activity', row);
}

/** Zentraler Hook für jede Mutation an einem Urlaub-bezogenen Objekt (Echtzeit-Sync/Nav-Badges/Push):
 *  schreibt einen trip_activity-Log-Eintrag, broadcastet ihn per SSE an alle gerade verbundenen
 *  Mitglieder desselben Urlaubs und stößt (best effort, blockiert die aufrufende Route nie) eine
 *  Push-Benachrichtigung an alle ANDEREN Mitglieder an. `domain` folgt den Nav-Item-Domänen
 *  (schedule/packing/shopping/todos/spots/ideas/travel/accommodation/budget/diary/notes/members),
 *  siehe stores/liveSync.ts im Frontend für die Gegenseite. */
export function recordActivity(
  tripId: number,
  domain: string,
  entityId: number | null,
  action: string,
  actorUserId: number,
): ActivityRow {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare(
      'INSERT INTO trip_activity (trip_id, domain, entity_id, action, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(tripId, domain, entityId, action, actorUserId, createdAt);
  const row: ActivityRow = {
    id: result.lastInsertRowid as number,
    trip_id: tripId,
    domain,
    entity_id: entityId,
    action,
    actor_user_id: actorUserId,
    created_at: createdAt,
  };
  broadcastActivity(tripId, row);

  const trip = db.prepare('SELECT name FROM trips WHERE id = ?').get(tripId) as { name: string } | undefined;
  const actor = db.prepare('SELECT username FROM users WHERE id = ?').get(actorUserId) as
    | { username: string }
    | undefined;
  if (trip && actor) {
    notifyTripMembers(tripId, actorUserId, {
      domain,
      action,
      tripName: trip.name,
      actorUsername: actor.username,
    }).catch(() => {});
  }

  return row;
}
