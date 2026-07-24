import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface IdeaBody {
  title: string;
  image_url?: string;
  link?: string;
  maps_link?: string;
  note?: string;
  status?: 'idea' | 'planned';
  lat?: number;
  lng?: number;
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get('/ideas', async () => {
    return db.prepare('SELECT * FROM ideas ORDER BY id DESC').all();
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { title, image_url, link, maps_link, note, status, lat, lng } = req.body;
    const result = db
      .prepare(
        `INSERT INTO ideas (title, image_url, link, maps_link, note, status, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
      );
    reply.code(201);
    return db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const { title, image_url, link, maps_link, note, status, lat, lng } = req.body;
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, link = ?, maps_link = ?, note = ?, status = ?, lat = ?, lng = ?
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
