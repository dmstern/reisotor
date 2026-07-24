import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ExpenseBody {
  title: string;
  category?: string;
  amount: number;
  paid_by_user_id?: number | null;
  date?: string;
  note?: string;
}

interface TargetBody {
  owner_id?: number | null;
  amount: number;
}

interface CategoryTargetBody {
  category: string;
  amount: number;
}

interface TransferBody {
  from_user_id: number;
  to_user_id: number;
  amount: number;
  date?: string;
  note?: string;
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  // --- Ausgaben (Bezahlungen) ---

  app.get('/budget', async () => {
    return db.prepare('SELECT * FROM budget_items ORDER BY date DESC, id DESC').all();
  });

  app.post<{ Body: ExpenseBody }>('/budget', async (req, reply) => {
    const { title, category, amount, paid_by_user_id, date, note } = req.body;
    const result = db
      .prepare(
        `INSERT INTO budget_items (title, category, amount, paid_by_user_id, date, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ExpenseBody }>('/budget/:id', async (req, reply) => {
    const { title, category, amount, paid_by_user_id, date, note } = req.body;
    const result = db
      .prepare(
        `UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, note = ?
         WHERE id = ?`,
      )
      .run(title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/budget/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Zielbudgets (gesamt + pro Nutzer) ---

  app.get('/budget/targets', async () => {
    return db.prepare('SELECT * FROM budget_targets').all();
  });

  app.put<{ Body: TargetBody }>('/budget/targets', async (req, reply) => {
    const { owner_id, amount } = req.body;
    const ownerId = owner_id ?? null;

    const existing = ownerId === null
      ? db.prepare('SELECT id FROM budget_targets WHERE owner_id IS NULL').get()
      : db.prepare('SELECT id FROM budget_targets WHERE owner_id = ?').get(ownerId);

    if (existing) {
      db.prepare('UPDATE budget_targets SET amount = ? WHERE id = ?').run(amount, (existing as { id: number }).id);
    } else {
      db.prepare('INSERT INTO budget_targets (owner_id, amount) VALUES (?, ?)').run(ownerId, amount);
    }

    const row = ownerId === null
      ? db.prepare('SELECT * FROM budget_targets WHERE owner_id IS NULL').get()
      : db.prepare('SELECT * FROM budget_targets WHERE owner_id = ?').get(ownerId);
    reply.code(200);
    return row;
  });

  // --- Kategorien-Zielbudgets ---

  app.get('/budget/category-targets', async () => {
    return db.prepare('SELECT * FROM budget_category_targets ORDER BY category').all();
  });

  app.put<{ Body: CategoryTargetBody }>('/budget/category-targets', async (req) => {
    const { category, amount } = req.body;
    db.prepare(
      `INSERT INTO budget_category_targets (category, amount) VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET amount = excluded.amount`,
    ).run(category, amount);
    return db.prepare('SELECT * FROM budget_category_targets WHERE category = ?').get(category);
  });

  app.delete<{ Params: { id: string } }>('/budget/category-targets/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_category_targets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Überweisungen (Schulden begleichen) ---

  app.get('/budget/transfers', async () => {
    return db.prepare('SELECT * FROM budget_transfers ORDER BY date DESC, id DESC').all();
  });

  app.post<{ Body: TransferBody }>('/budget/transfers', async (req, reply) => {
    const { from_user_id, to_user_id, amount, date, note } = req.body;
    const result = db
      .prepare(
        'INSERT INTO budget_transfers (from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?)',
      )
      .run(from_user_id, to_user_id, amount, date ?? null, note ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TransferBody }>('/budget/transfers/:id', async (req, reply) => {
    const { from_user_id, to_user_id, amount, date, note } = req.body;
    const result = db
      .prepare(
        'UPDATE budget_transfers SET from_user_id = ?, to_user_id = ?, amount = ?, date = ?, note = ? WHERE id = ?',
      )
      .run(from_user_id, to_user_id, amount, date ?? null, note ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/budget/transfers/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_transfers WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
