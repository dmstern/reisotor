import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ExpenseBody {
  trip_id: number;
  title: string;
  category?: string;
  amount: number;
  paid_by_user_id?: number | null;
  date?: string;
  note?: string;
  budget_id?: number | null;
}

interface BudgetBody {
  trip_id: number;
  name: string;
  owner_id?: number | null;
}

interface AllocationBody {
  budget_id: number;
  category: string;
  amount: number;
}

interface TransferBody {
  trip_id: number;
  from_user_id: number;
  to_user_id: number;
  amount: number;
  date?: string;
  note?: string;
}

function requireTripId(query: { trip_id?: string }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if (!query.trip_id) {
    reply.code(400).send({ error: 'trip_id erforderlich' });
    return false;
  }
  return true;
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  // --- Ausgaben (Bezahlungen) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db
      .prepare('SELECT * FROM budget_items WHERE trip_id = ? ORDER BY date DESC, id DESC')
      .all(req.query.trip_id);
  });

  app.post<{ Body: ExpenseBody }>('/budget', async (req, reply) => {
    const { trip_id, title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
    const result = db
      .prepare(
        `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null, budget_id ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ExpenseBody }>('/budget/:id', async (req, reply) => {
    const { title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
    const result = db
      .prepare(
        `UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, note = ?, budget_id = ?
         WHERE id = ?`,
      )
      .run(title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null, budget_id ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/budget/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Budgets (persönlich oder geteilt) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/budgets', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db.prepare('SELECT * FROM budgets WHERE trip_id = ? ORDER BY owner_id IS NOT NULL, id').all(req.query.trip_id);
  });

  app.post<{ Body: BudgetBody }>('/budget/budgets', async (req, reply) => {
    const { trip_id, name, owner_id } = req.body;
    if (!name?.trim()) return reply.code(400).send({ error: 'Name erforderlich' });
    const result = db
      .prepare('INSERT INTO budgets (trip_id, name, owner_id) VALUES (?, ?, ?)')
      .run(trip_id, name.trim(), owner_id ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: BudgetBody }>('/budget/budgets/:id', async (req, reply) => {
    const { name, owner_id } = req.body;
    if (!name?.trim()) return reply.code(400).send({ error: 'Name erforderlich' });
    const result = db
      .prepare('UPDATE budgets SET name = ?, owner_id = ? WHERE id = ?')
      .run(name.trim(), owner_id ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/budget/budgets/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Kategorien-Aufteilung je Budget ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/allocations', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db
      .prepare(
        `SELECT a.* FROM budget_allocations a
         JOIN budgets b ON b.id = a.budget_id
         WHERE b.trip_id = ?
         ORDER BY a.category`,
      )
      .all(req.query.trip_id);
  });

  app.put<{ Body: AllocationBody }>('/budget/allocations', async (req, reply) => {
    const { budget_id, category, amount } = req.body;
    if (!category?.trim()) return reply.code(400).send({ error: 'Kategorie erforderlich' });
    db.prepare(
      `INSERT INTO budget_allocations (budget_id, category, amount) VALUES (?, ?, ?)
       ON CONFLICT(budget_id, category) DO UPDATE SET amount = excluded.amount`,
    ).run(budget_id, category.trim(), amount || 0);
    return db
      .prepare('SELECT * FROM budget_allocations WHERE budget_id = ? AND category = ?')
      .get(budget_id, category.trim());
  });

  app.delete<{ Params: { id: string } }>('/budget/allocations/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_allocations WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Überweisungen (Schulden begleichen) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/transfers', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db
      .prepare('SELECT * FROM budget_transfers WHERE trip_id = ? ORDER BY date DESC, id DESC')
      .all(req.query.trip_id);
  });

  app.post<{ Body: TransferBody }>('/budget/transfers', async (req, reply) => {
    const { trip_id, from_user_id, to_user_id, amount, date, note } = req.body;
    const result = db
      .prepare(
        'INSERT INTO budget_transfers (trip_id, from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(trip_id, from_user_id, to_user_id, amount, date ?? null, note ?? null);
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
