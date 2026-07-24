import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface SpotBody {
  name: string;
  category?: string;
  link?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

export const spotsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/spots', async () => {
    return db.prepare('SELECT * FROM spots ORDER BY id DESC').all();
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const { name, category, link, note, lat, lng } = req.body;
    const result = db
      .prepare(
        'INSERT INTO spots (name, category, link, note, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(name, category ?? null, link ?? null, note ?? null, lat ?? null, lng ?? null);
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
