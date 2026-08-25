import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

interface TrackRow {
  id: number;
  trip_id: number;
  user_id: number;
  excursion_id: number | null;
  title: string | null;
  visibility: 'private' | 'shared';
  started_at: string;
  ended_at: string | null;
  deleted_at: string | null;
}

interface StartTrackBody {
  trip_id: number;
  excursion_id?: number | null;
  visibility?: 'private' | 'shared';
  title?: string;
}

interface UpdateTrackBody {
  title?: string | null;
  visibility?: 'private' | 'shared';
  excursion_id?: number | null;
}

interface TrackPointInput {
  lat: number;
  lng: number;
  recorded_at: string;
  accuracy?: number;
}

interface AppendPointsBody {
  points: TrackPointInput[];
}

/** Ein Track ist für seine Aufzeichnerin immer sichtbar, für alle anderen Trip-Mitglieder nur bei
 *  visibility='shared' (Standard beim Start: 'private', siehe DESIGN.md's 🔒/🤝-Konzept, gleiches
 *  Muster wie private Budget-Töpfe in routes/trash.ts's isBudgetItemVisible). */
function isTrackVisible(
  track: Pick<TrackRow, 'user_id' | 'visibility'>,
  userId: number | undefined
): boolean {
  return track.user_id === userId || track.visibility === 'shared';
}

export const tracksRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/tracks', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const rows = db
      .prepare(
        `SELECT * FROM location_tracks
         WHERE trip_id = ? AND deleted_at IS NULL AND (user_id = ? OR visibility = 'shared')
         ORDER BY started_at DESC`
      )
      .all(req.query.trip_id, req.session.userId) as TrackRow[];
    return rows;
  });

  app.post<{ Body: StartTrackBody }>('/tracks', async (req, reply) => {
    const { trip_id, excursion_id, visibility, title } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const startedAt = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO location_tracks (trip_id, user_id, excursion_id, title, visibility, started_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        trip_id,
        req.session.userId,
        excursion_id ?? null,
        title ?? null,
        visibility === 'shared' ? 'shared' : 'private',
        startedAt
      );
    reply.code(201);
    return db
      .prepare('SELECT * FROM location_tracks WHERE id = ?')
      .get(result.lastInsertRowid) as TrackRow;
  });

  // Batched Anhängen von GPS-Punkten (stores/trackRecording.ts flusht periodisch statt jeden
  // einzelnen Punkt zu senden). Bewusst KEIN recordActivity() hier - analog zum Kommentar bei
  // POST /realtime/position: einzelne GPS-Punkte sollen weder Aktivitäts-Log noch Push auslösen,
  // erst recht nicht in dieser Frequenz.
  app.post<{ Params: { id: string }; Body: AppendPointsBody }>(
    '/tracks/:id/points',
    async (req, reply) => {
      const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id) as
        TrackRow | undefined;
      if (!track || track.deleted_at) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, track.trip_id, req.session.userId)) return;
      if (track.user_id !== req.session.userId) {
        return reply
          .code(403)
          .send({ error: 'Nur die aufzeichnende Person kann Punkte hinzufügen' });
      }
      const points = req.body.points ?? [];
      if (!points.length) return reply.code(204).send();
      const insert = db.prepare(
        'INSERT INTO location_track_points (track_id, lat, lng, recorded_at, accuracy) VALUES (?, ?, ?, ?, ?)'
      );
      const insertAll = db.transaction((rows: TrackPointInput[]) => {
        for (const p of rows) insert.run(track.id, p.lat, p.lng, p.recorded_at, p.accuracy ?? null);
      });
      insertAll(points);
      return reply.code(204).send();
    }
  );

  app.get<{ Params: { id: string } }>('/tracks/:id/points', async (req, reply) => {
    const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id) as
      TrackRow | undefined;
    if (!track) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, track.trip_id, req.session.userId)) return;
    if (!isTrackVisible(track, req.session.userId)) {
      return reply.code(403).send({ error: 'Kein Zugriff auf diese Aufzeichnung' });
    }
    return db
      .prepare('SELECT * FROM location_track_points WHERE track_id = ? ORDER BY recorded_at ASC')
      .all(track.id);
  });

  app.post<{ Params: { id: string } }>('/tracks/:id/stop', async (req, reply) => {
    const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id) as
      TrackRow | undefined;
    if (!track || track.deleted_at) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, track.trip_id, req.session.userId)) return;
    if (track.user_id !== req.session.userId) {
      return reply
        .code(403)
        .send({ error: 'Nur die aufzeichnende Person kann die Aufzeichnung beenden' });
    }
    db.prepare('UPDATE location_tracks SET ended_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      track.id
    );
    return db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(track.id) as TrackRow;
  });

  app.put<{ Params: { id: string }; Body: UpdateTrackBody }>('/tracks/:id', async (req, reply) => {
    const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id) as
      TrackRow | undefined;
    if (!track || track.deleted_at) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, track.trip_id, req.session.userId)) return;
    if (track.user_id !== req.session.userId) {
      return reply
        .code(403)
        .send({ error: 'Nur die aufzeichnende Person kann diese Aufzeichnung bearbeiten' });
    }
    const title = req.body.title !== undefined ? req.body.title : track.title;
    const visibility = req.body.visibility ?? track.visibility;
    const excursionId =
      req.body.excursion_id !== undefined ? req.body.excursion_id : track.excursion_id;
    db.prepare(
      'UPDATE location_tracks SET title = ?, visibility = ?, excursion_id = ? WHERE id = ?'
    ).run(title, visibility, excursionId, track.id);
    // Erst beim Wechsel auf "geteilt" benachrichtigen/hervorheben (nicht bei jeder sonstigen
    // Bearbeitung wie Titel/Tour-Kopplung) - Domäne 'ideas' wiederverwendet statt einer eigenen
    // LiveDomain, da Aufzeichnungen visuell/organisatorisch in ExcursionsView.vue/der Karte leben
    // und kein eigenes Nav-Item haben (siehe Plan-Kommentar).
    if (track.visibility !== 'shared' && visibility === 'shared') {
      recordActivity(
        track.trip_id,
        'ideas',
        track.excursion_id ?? track.id,
        'track-shared',
        req.session.userId!
      );
    }
    return db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(track.id) as TrackRow;
  });

  app.delete<{ Params: { id: string } }>('/tracks/:id', async (req, reply) => {
    const track = db.prepare('SELECT * FROM location_tracks WHERE id = ?').get(req.params.id) as
      TrackRow | undefined;
    if (!track || track.deleted_at) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, track.trip_id, req.session.userId)) return;
    if (track.user_id !== req.session.userId) {
      return reply
        .code(403)
        .send({ error: 'Nur die aufzeichnende Person kann diese Aufzeichnung löschen' });
    }
    db.prepare('UPDATE location_tracks SET deleted_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      track.id
    );
    return reply.code(204).send();
  });
};
