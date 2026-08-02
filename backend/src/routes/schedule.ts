import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';

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
}

// Ist der Termin mit einem Spot verknüpft, kommen Standort-Koordinaten/Maps-Link vom Spot selbst
// statt aus separat gepflegten Feldern – Auswahl eines Spots (siehe ScheduleView.vue's
// Verknüpfungs-Auswahl) ersetzt damit die manuelle Standort-Eingabe, sie bleibt bei verknüpften
// Terminen unbenutzt/ausgeblendet (kein zweites, potenziell abweichendes Standort-Feld).
function locationFromSpot(spotId: number | null | undefined) {
  if (!spotId) return null;
  return db.prepare('SELECT maps_link, lat, lng FROM spots WHERE id = ?').get(spotId) as
    | { maps_link: string | null; lat: number | null; lng: number | null }
    | undefined;
}

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/schedule', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare('SELECT * FROM schedule_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date, time')
      .all(req.query.trip_id);
  });

  app.post<{ Body: ScheduleBody }>('/schedule', async (req, reply) => {
    const { trip_id, date, end_date, time, end_time, title, note, location, maps_link, lat, lng, spot_id, idea_id } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const spot = locationFromSpot(spot_id);
    const result = db
      .prepare(
        `INSERT INTO schedule_items
          (trip_id, date, end_date, time, end_time, title, note, location, maps_link, lat, lng, spot_id, idea_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
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
      );
    reply.code(201);
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ScheduleBody }>('/schedule/:id', async (req, reply) => {
    const existingItem = db.prepare('SELECT trip_id FROM schedule_items WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const { date, end_date, time, end_time, title, note, location, maps_link, lat, lng, spot_id, idea_id } = req.body;
    const spot = locationFromSpot(spot_id);
    const result = db
      .prepare(
        `UPDATE schedule_items
         SET date = ?, end_date = ?, time = ?, end_time = ?, title = ?, note = ?, location = ?, maps_link = ?, lat = ?, lng = ?,
             spot_id = ?, idea_id = ?
         WHERE id = ?`,
      )
      .run(
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
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(req.params.id);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen, damit sie sich wiederherstellen lässt.
  app.delete<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const existingItem = db.prepare('SELECT trip_id FROM schedule_items WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const result = db
      .prepare('UPDATE schedule_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
