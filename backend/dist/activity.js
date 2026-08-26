import { db } from './db/index.js';
import { notifyTripMembers } from './push.js';
// In-Memory statt in der DB: Verbindungen sind pro Prozess flüchtig (überleben keinen Neustart,
// brauchen es auch nicht – ein neu verbindender Client bekommt seinen aktuellen Stand ohnehin über
// GET /trip-activity?since= nachgeliefert, siehe routes/realtime.ts).
const connectionsByTrip = new Map();
function writeEvent(reply, event, data) {
    try {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
    catch {
        // Verbindung ist zwischen Broadcast und Schreibversuch schon weg (Race mit dem close-Handler in
        // routes/realtime.ts) – kein Fehlerfall, der nächste Broadcast trifft diese Connection ohnehin
        // nicht mehr (sie wurde beim close bereits aus dem Set entfernt).
    }
}
export function onlineUserIds(tripId) {
    const set = connectionsByTrip.get(tripId);
    if (!set)
        return [];
    return [...new Set([...set].map((c) => c.userId))];
}
function broadcastPresence(tripId) {
    const set = connectionsByTrip.get(tripId);
    if (!set)
        return;
    const online = onlineUserIds(tripId);
    for (const conn of set)
        writeEvent(conn.reply, 'presence', { online });
}
/** Registriert eine offene SSE-Verbindung für einen Urlaub/eine Session (routes/realtime.ts ruft das
 *  direkt nach dem Öffnen des Streams auf) und broadcastet den neuen Online-Stand an alle Mitglieder
 *  desselben Urlaubs (Präsenzanzeige im Header, ähnlich Google Docs). Gibt eine Unsubscribe-Funktion
 *  zurück, die beim Verbindungsabbau (req.raw 'close') aufgerufen werden muss. */
export function subscribe(tripId, userId, reply) {
    const conn = { reply, userId };
    let set = connectionsByTrip.get(tripId);
    if (!set) {
        set = new Set();
        connectionsByTrip.set(tripId, set);
    }
    set.add(conn);
    broadcastPresence(tripId);
    return () => {
        set.delete(conn);
        if (set.size === 0)
            connectionsByTrip.delete(tripId);
        broadcastPresence(tripId);
    };
}
// Live-Standort auf der Karte (TripMap.vue): rein speicherinterner, ephemerer Broadcast-Kanal,
// bewusst GETRENNT von recordActivity()/trip_activity oben – ein GPS-Ping alle paar Sekunden soll
// weder eine dauerhafte DB-Zeile noch eine Push-Benachrichtigung pro Update auslösen. Nutzt
// dieselbe SSE-Verbindung (connectionsByTrip) wie die Aktivitäts-/Präsenz-Events, nur mit einem
// eigenen Event-Typ ('position'/'positions').
const lastPositionsByTrip = new Map();
export function positionsFor(tripId) {
    const map = lastPositionsByTrip.get(tripId);
    if (!map)
        return {};
    return Object.fromEntries(map);
}
export function updatePosition(tripId, userId, lat, lng) {
    let map = lastPositionsByTrip.get(tripId);
    if (!map) {
        map = new Map();
        lastPositionsByTrip.set(tripId, map);
    }
    const position = { lat, lng, updatedAt: new Date().toISOString() };
    map.set(userId, position);
    broadcastPosition(tripId, userId, position);
}
export function clearPosition(tripId, userId) {
    const map = lastPositionsByTrip.get(tripId);
    if (!map?.delete(userId))
        return;
    broadcastPosition(tripId, userId, null);
}
function broadcastPosition(tripId, userId, position) {
    const set = connectionsByTrip.get(tripId);
    if (!set)
        return;
    for (const conn of set)
        writeEvent(conn.reply, 'position', { userId, position });
}
function broadcastActivity(tripId, row) {
    const set = connectionsByTrip.get(tripId);
    if (!set)
        return;
    for (const conn of set)
        writeEvent(conn.reply, 'activity', row);
}
/** Zentraler Hook für jede Mutation an einem Urlaub-bezogenen Objekt (Echtzeit-Sync/Nav-Badges/Push):
 *  schreibt einen trip_activity-Log-Eintrag, broadcastet ihn per SSE an alle gerade verbundenen
 *  Mitglieder desselben Urlaubs und stößt (best effort, blockiert die aufrufende Route nie) eine
 *  Push-Benachrichtigung an alle ANDEREN Mitglieder an. `domain` folgt den Nav-Item-Domänen
 *  (schedule/packing/shopping/todos/spots/ideas/budget/diary/notes/members),
 *  siehe stores/liveSync.ts im Frontend für die Gegenseite. */
export function recordActivity(tripId, domain, entityId, action, actorUserId) {
    const createdAt = new Date().toISOString();
    const result = db
        .prepare('INSERT INTO trip_activity (trip_id, domain, entity_id, action, actor_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tripId, domain, entityId, action, actorUserId, createdAt);
    const row = {
        id: result.lastInsertRowid,
        trip_id: tripId,
        domain,
        entity_id: entityId,
        action,
        actor_user_id: actorUserId,
        created_at: createdAt,
    };
    broadcastActivity(tripId, row);
    const trip = db.prepare('SELECT name FROM trips WHERE id = ?').get(tripId);
    const actor = db.prepare('SELECT username FROM users WHERE id = ?').get(actorUserId);
    if (trip && actor) {
        notifyTripMembers(tripId, actorUserId, {
            domain,
            action,
            tripName: trip.name,
            actorUsername: actor.username,
        }).catch(() => { });
    }
    return row;
}
