import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  link?: string;
  maps_link?: string;
  note?: string;
  status?: 'idea' | 'planned' | 'discarded';
  lat?: number;
  lng?: number;
  suggested_by_user_id?: number | null;
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM ideas WHERE trip_id = ? ORDER BY id DESC').all(req.query.trip_id);
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { trip_id, title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id } = req.body;
    const result = db
      .prepare(
        `INSERT INTO ideas (trip_id, title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        title,
        image_url ?? null,
        link ?? null,
        maps_link ?? null,
        note ?? null,
        status ?? 'idea',
        lat ?? null,
        lng ?? null,
        suggested_by_user_id ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const { title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id } = req.body;
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, link = ?, maps_link = ?, note = ?, status = ?, lat = ?, lng = ?, suggested_by_user_id = ?
         WHERE id = ?`,
      )
      .run(
        title,
        image_url ?? null,
        link ?? null,
        maps_link ?? null,
        note ?? null,
        status ?? 'idea',
        lat ?? null,
        lng ?? null,
        suggested_by_user_id ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/ideas/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
