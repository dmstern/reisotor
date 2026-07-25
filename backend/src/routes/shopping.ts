import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ShoppingBody {
  trip_id: number;
  label: string;
  assigned_to_user_id?: number | null;
  checked?: boolean;
  link?: string;
  note?: string;
}

export const shoppingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/shopping', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM shopping_items WHERE trip_id = ? ORDER BY checked, id DESC')
      .all(req.query.trip_id);
  });

  app.post<{ Body: ShoppingBody }>('/shopping', async (req, reply) => {
    const { trip_id, label, assigned_to_user_id, checked, link, note } = req.body;
    const result = db
      .prepare(
        'INSERT INTO shopping_items (trip_id, label, assigned_to_user_id, checked, link, note) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(trip_id, label, assigned_to_user_id ?? null, checked ? 1 : 0, link ?? null, note ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ShoppingBody }>('/shopping/:id', async (req, reply) => {
    const { label, assigned_to_user_id, checked, link, note } = req.body;
    const result = db
      .prepare(
        'UPDATE shopping_items SET label = ?, assigned_to_user_id = ?, checked = ?, link = ?, note = ? WHERE id = ?',
      )
      .run(label, assigned_to_user_id ?? null, checked ? 1 : 0, link ?? null, note ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/shopping/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM shopping_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
