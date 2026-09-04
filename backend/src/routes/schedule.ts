import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

interface ScheduleBody {
  trip_id: number;
  date: string;
  end_date?: string | null;
  time?: string;
  end_time?: string;
  title: string;
  note?: string;
  location?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
  spot_id?: number | null;
  idea_id?: number | null;
  auto_created?: number | boolean | null;
  user_modified?: number | boolean | null;
}

// Ist der Termin mit einem Spot verknüpft, kommen Standort-Koordinaten/Maps-Link vom Spot selbst
// statt aus separat gepflegten Feldern – Auswahl eines Spots (siehe ScheduleView.vue's
// Verknüpfungs-Auswahl) ersetzt damit die manuelle Standort-Eingabe, sie bleibt bei verknüpften
// Terminen unbenutzt/ausgeblendet (kein zweites, potenziell abweichendes Standort-Feld).
const selectSpotLocationStmt = db.prepare('SELECT maps_link, lat, lng FROM spots WHERE id = ?');
const selectScheduleByTripStmt = db.prepare(
  'SELECT * FROM schedule_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date, time'
);
const insertScheduleStmt = db.prepare(
  `INSERT INTO schedule_items
    (trip_id, date, end_date, time, end_time, title, note, location, maps_link, lat, lng, spot_id, idea_id, auto_created, user_modified)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectScheduleItemByIdStmt = db.prepare('SELECT * FROM schedule_items WHERE id = ?');
const selectScheduleTripIdStmt = db.prepare('SELECT trip_id FROM schedule_items WHERE id = ?');
const updateScheduleStmt = db.prepare(
  `UPDATE schedule_items
   SET date = ?, end_date = ?, time = ?, end_time = ?, title = ?, note = ?, location = ?, maps_link = ?, lat = ?, lng = ?,
       spot_id = ?, idea_id = ?, auto_created = ?, user_modified = ?
   WHERE id = ?`
);
const softDeleteScheduleStmt = db.prepare(
  'UPDATE schedule_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
);

function locationFromSpot(spotId: number | null | undefined) {
  if (!spotId) return null;
  return selectSpotLocationStmt.get(spotId) as
    { maps_link: string | null; lat: number | null; lng: number | null } | undefined;
}

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/schedule', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return selectScheduleByTripStmt.all(req.query.trip_id);
  });

  app.post<{ Body: ScheduleBody }>('/schedule', async (req, reply) => {
    const {
      trip_id,
      date,
      end_date,
      time,
      end_time,
      title,
      note,
      location,
      maps_link,
      lat,
      lng,
      spot_id,
      idea_id,
      auto_created,
      user_modified,
    } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const spot = locationFromSpot(spot_id);
    const result = insertScheduleStmt.run(
      trip_id,
      date,
      end_date ?? null,
      time ?? null,
      end_time ?? null,
      title,
      note ?? null,
      location ?? null,
      spot?.maps_link ?? maps_link ?? null,
      spot?.lat ?? lat ?? null,
      spot?.lng ?? lng ?? null,
      spot_id ?? null,
      idea_id ?? null,
      auto_created ? 1 : 0,
      user_modified ? 1 : 0
    );
    recordActivity(
      trip_id,
      'schedule',
      result.lastInsertRowid as number,
      'created',
      req.session.userId!
    );
    reply.code(201);
    return selectScheduleItemByIdStmt.get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ScheduleBody }>('/schedule/:id', async (req, reply) => {
    const existingItem = selectScheduleItemByIdStmt.get(req.params.id) as
      { trip_id: number; auto_created?: number; user_modified?: number } | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const {
      date,
      end_date,
      time,
      end_time,
      title,
      note,
      location,
      maps_link,
      lat,
      lng,
      spot_id,
      idea_id,
      auto_created,
      user_modified,
    } = req.body;
    const spot = locationFromSpot(spot_id);
    const resolvedUserModified =
      user_modified !== undefined ? (user_modified ? 1 : 0) : (existingItem.user_modified ?? 1);
    const resolvedAutoCreated =
      auto_created !== undefined ? (auto_created ? 1 : 0) : (existingItem.auto_created ?? 0);

    const result = updateScheduleStmt.run(
      date,
      end_date ?? null,
      time ?? null,
      end_time ?? null,
      title,
      note ?? null,
      location ?? null,
      spot?.maps_link ?? maps_link ?? null,
      spot?.lat ?? lat ?? null,
      spot?.lng ?? lng ?? null,
      spot_id ?? null,
      idea_id ?? null,
      resolvedAutoCreated,
      resolvedUserModified,
      req.params.id
    );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingItem.trip_id,
      'schedule',
      Number(req.params.id),
      'updated',
      req.session.userId!
    );
    return selectScheduleItemByIdStmt.get(req.params.id);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen, damit sie sich wiederherstellen lässt.
  app.delete<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const existingItem = selectScheduleTripIdStmt.get(req.params.id) as
      { trip_id: number } | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const result = softDeleteScheduleStmt.run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingItem.trip_id,
      'schedule',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });
};
