import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface PackingBody {
  trip_id: number;
  category?: string;
  label: string;
  checked?: boolean;
  owner_id?: number | null;
}

export const packingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/packing', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM packing_items WHERE trip_id = ? ORDER BY category, label')
      .all(req.query.trip_id);
  });

  app.post<{ Body: PackingBody }>('/packing', async (req, reply) => {
    const { trip_id, category, label, checked, owner_id } = req.body;
    const result = db
      .prepare('INSERT INTO packing_items (trip_id, category, label, checked, owner_id) VALUES (?, ?, ?, ?, ?)')
      .run(trip_id, category ?? null, label, checked ? 1 : 0, owner_id ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: PackingBody }>('/packing/:id', async (req, reply) => {
    const { category, label, checked, owner_id } = req.body;
    const result = db
      .prepare('UPDATE packing_items SET category = ?, label = ?, checked = ?, owner_id = ? WHERE id = ?')
      .run(category ?? null, label, checked ? 1 : 0, owner_id ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/packing/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM packing_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
