import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ScheduleBody {
  trip_id: number;
  date: string;
  end_date?: string | null;
  time?: string;
  title: string;
  note?: string;
  location?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
}

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/schedule', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM schedule_items WHERE trip_id = ? ORDER BY date, time')
      .all(req.query.trip_id);
  });

  app.post<{ Body: ScheduleBody }>('/schedule', async (req, reply) => {
    const { trip_id, date, end_date, time, title, note, location, maps_link, lat, lng } = req.body;
    const result = db
      .prepare(
        `INSERT INTO schedule_items (trip_id, date, end_date, time, title, note, location, maps_link, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        date,
        end_date ?? null,
        time ?? null,
        title,
        note ?? null,
        location ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ScheduleBody }>('/schedule/:id', async (req, reply) => {
    const { date, end_date, time, title, note, location, maps_link, lat, lng } = req.body;
    const result = db
      .prepare(
        `UPDATE schedule_items
         SET date = ?, end_date = ?, time = ?, title = ?, note = ?, location = ?, maps_link = ?, lat = ?, lng = ?
         WHERE id = ?`,
      )
      .run(
        date,
        end_date ?? null,
        time ?? null,
        title,
        note ?? null,
        location ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM schedule_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
