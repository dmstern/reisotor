import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface SpotBody {
  trip_id: number;
  name: string;
  category?: string;
  link?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

export const spotsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/spots', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM spots WHERE trip_id = ? ORDER BY id DESC').all(req.query.trip_id);
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const { trip_id, name, category, link, note, lat, lng } = req.body;
    const result = db
      .prepare(
        'INSERT INTO spots (trip_id, name, category, link, note, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(trip_id, name, category ?? null, link ?? null, note ?? null, lat ?? null, lng ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: SpotBody }>('/spots/:id', async (req, reply) => {
    const { name, category, link, note, lat, lng } = req.body;
    const result = db
      .prepare(
        'UPDATE spots SET name = ?, category = ?, link = ?, note = ?, lat = ?, lng = ? WHERE id = ?',
      )
      .run(name, category ?? null, link ?? null, note ?? null, lat ?? null, lng ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/spots/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM spots WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
