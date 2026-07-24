import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface BudgetBody {
  title: string;
  category?: string;
  amount: number;
  paid_by?: string;
  is_paid?: boolean;
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  app.get('/budget', async () => {
    return db.prepare('SELECT * FROM budget_items ORDER BY id DESC').all();
  });

  app.post<{ Body: BudgetBody }>('/budget', async (req, reply) => {
    const { title, category, amount, paid_by, is_paid } = req.body;
    const result = db
      .prepare(
        'INSERT INTO budget_items (title, category, amount, paid_by, is_paid) VALUES (?, ?, ?, ?, ?)',
      )
      .run(title, category ?? null, amount, paid_by ?? null, is_paid ? 1 : 0);
    reply.code(201);
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: BudgetBody }>('/budget/:id', async (req, reply) => {
    const { title, category, amount, paid_by, is_paid } = req.body;
    const result = db
      .prepare(
        'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by = ?, is_paid = ? WHERE id = ?',
      )
      .run(title, category ?? null, amount, paid_by ?? null, is_paid ? 1 : 0, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/budget/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
