import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
/** Ein Track ist für seine Aufzeichnerin immer sichtbar, für alle anderen Trip-Mitglieder nur bei
 *  visibility='shared' (Standard beim Start: 'private', siehe DESIGN.md's 🔒/🤝-Konzept, gleiches
 *  Muster wie private Budget-Töpfe in routes/trash.ts's isBudgetItemVisible). */
function isTrackVisible(track, userId) {
    return track.user_id === userId || track.visibility === 'shared';
}
export const tracksRoutes = async (app) => {
    app.get('/tracks', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const rows = db
            .prepare(`SELECT * FROM location_tracks
         WHERE trip_id = ? AND deleted_at IS NULL AND (user_id = ? OR visibility = 'shared')
         ORDER BY started_at DESC`)
            .all(req.query.trip_id, req.session.userId);
        return rows;
    });
    app.post('/tracks', async (req, reply) => {
        const { trip_id, excursion_id, visibility, title } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const startedAt = new Date().toISOString();
        const result = db
            .prepare(`INSERT INTO location_tracks (trip_id, user_id, excursion_id, title, visibility, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`)
            .run(trip_id, req.session.userId, excursion_id ?? null, title ?? null, visibility === 'shared' ? 'shared' : 'private', startedAt);
        reply.code(201);
        return db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(result.lastInsertRowid);
    });
    // Batched Anhängen von GPS-Punkten (stores/trackRecording.ts flusht periodisch statt jeden
    // einzelnen Punkt zu senden). Bewusst KEIN recordActivity() hier - analog zum Kommentar bei
    // POST /realtime/position: einzelne GPS-Punkte sollen weder Aktivitäts-Log noch Push auslösen,
    // erst recht nicht in dieser Frequenz.
    app.post('/tracks/:id/points', async (req, reply) => {
        const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id);
        if (!track || track.deleted_at)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, track.trip_id, req.session.userId))
            return;
        if (track.user_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die aufzeichnende Person kann Punkte hinzufügen' });
        }
        const points = req.body.points ?? [];
        if (!points.length)
            return reply.code(204).send();
        const insert = db.prepare('INSERT INTO location_track_points (track_id, lat, lng, recorded_at, accuracy) VALUES (?, ?, ?, ?, ?)');
        const insertAll = db.transaction((rows) => {
            for (const p of rows)
                insert.run(track.id, p.lat, p.lng, p.recorded_at, p.accuracy ?? null);
        });
        insertAll(points);
        return reply.code(204).send();
    });
    app.get('/tracks/:id/points', async (req, reply) => {
        const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id);
        if (!track)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, track.trip_id, req.session.userId))
            return;
        if (!isTrackVisible(track, req.session.userId)) {
            return reply.code(403).send({ error: 'Kein Zugriff auf diese Aufzeichnung' });
        }
        return db
            .prepare('SELECT * FROM location_track_points WHERE track_id = ? ORDER BY recorded_at ASC')
            .all(track.id);
    });
    app.post('/tracks/:id/stop', async (req, reply) => {
        const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id);
        if (!track || track.deleted_at)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, track.trip_id, req.session.userId))
            return;
        if (track.user_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die aufzeichnende Person kann die Aufzeichnung beenden' });
        }
        db.prepare('UPDATE location_tracks SET ended_at = ? WHERE id = ?').run(new Date().toISOString(), track.id);
        return db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(track.id);
    });
    app.put('/tracks/:id', async (req, reply) => {
        const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id);
        if (!track || track.deleted_at)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, track.trip_id, req.session.userId))
            return;
        if (track.user_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die aufzeichnende Person kann diese Aufzeichnung bearbeiten' });
        }
        const title = req.body.title !== undefined ? req.body.title : track.title;
        const visibility = req.body.visibility ?? track.visibility;
        const excursionId = req.body.excursion_id !== undefined ? req.body.excursion_id : track.excursion_id;
        db.prepare('UPDATE location_tracks SET title = ?, visibility = ?, excursion_id = ? WHERE id = ?').run(title, visibility, excursionId, track.id);
        // Erst beim Wechsel auf "geteilt" benachrichtigen/hervorheben (nicht bei jeder sonstigen
        // Bearbeitung wie Titel/Tour-Kopplung) - Domäne 'ideas' wiederverwendet statt einer eigenen
        // LiveDomain, da Aufzeichnungen visuell/organisatorisch in ExcursionsView.vue/der Karte leben
        // und kein eigenes Nav-Item haben (siehe Plan-Kommentar).
        if (track.visibility !== 'shared' && visibility === 'shared') {
            recordActivity(track.trip_id, 'ideas', track.excursion_id ?? track.id, 'track-shared', req.session.userId);
        }
        return db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(track.id);
    });
    app.delete('/tracks/:id', async (req, reply) => {
        const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id);
        if (!track || track.deleted_at)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, track.trip_id, req.session.userId))
            return;
        if (track.user_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die aufzeichnende Person kann diese Aufzeichnung löschen' });
        }
        db.prepare('UPDATE location_tracks SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), track.id);
        return reply.code(204).send();
    });
};
