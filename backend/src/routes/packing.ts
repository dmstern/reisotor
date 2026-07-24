import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface PackingBody {
  category?: string;
  label: string;
  checked?: boolean;
}

export const packingRoutes: FastifyPluginAsync = async (app) => {
  app.get('/packing', async () => {
    return db.prepare('SELECT * FROM packing_items ORDER BY category, label').all();
  });

  app.post<{ Body: PackingBody }>('/packing', async (req, reply) => {
    const { category, label, checked } = req.body;
    const result = db
      .prepare('INSERT INTO packing_items (category, label, checked) VALUES (?, ?, ?)')
      .run(category ?? null, label, checked ? 1 : 0);
    reply.code(201);
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: PackingBody }>('/packing/:id', async (req, reply) => {
    const { category, label, checked } = req.body;
    const result = db
      .prepare('UPDATE packing_items SET category = ?, label = ?, checked = ? WHERE id = ?')
      .run(category ?? null, label, checked ? 1 : 0, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/packing/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM packing_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
