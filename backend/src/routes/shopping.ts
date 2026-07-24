import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ShoppingBody {
  label: string;
  assigned_to_user_id?: number | null;
  checked?: boolean;
  link?: string;
  note?: string;
}

export const shoppingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/shopping', async () => {
    return db.prepare('SELECT * FROM shopping_items ORDER BY checked, id DESC').all();
  });

  app.post<{ Body: ShoppingBody }>('/shopping', async (req, reply) => {
    const { label, assigned_to_user_id, checked, link, note } = req.body;
    const result = db
      .prepare(
        'INSERT INTO shopping_items (label, assigned_to_user_id, checked, link, note) VALUES (?, ?, ?, ?, ?)',
      )
      .run(label, assigned_to_user_id ?? null, checked ? 1 : 0, link ?? null, note ?? null);
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
