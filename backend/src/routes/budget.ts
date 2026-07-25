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
}

interface TargetBody {
  trip_id: number;
  owner_id?: number | null;
  amount: number;
}

interface CategoryTargetBody {
  trip_id: number;
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
    const { trip_id, title, category, amount, paid_by_user_id, date, note } = req.body;
    const result = db
      .prepare(
        `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null);
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

  app.get<{ Querystring: { trip_id?: string } }>('/budget/targets', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db.prepare('SELECT * FROM budget_targets WHERE trip_id = ?').all(req.query.trip_id);
  });

  app.put<{ Body: TargetBody }>('/budget/targets', async (req, reply) => {
    const { trip_id, owner_id, amount } = req.body;
    const ownerId = owner_id ?? null;

    const existing = ownerId === null
      ? db.prepare('SELECT id FROM budget_targets WHERE trip_id = ? AND owner_id IS NULL').get(trip_id)
      : db.prepare('SELECT id FROM budget_targets WHERE trip_id = ? AND owner_id = ?').get(trip_id, ownerId);

    if (existing) {
      db.prepare('UPDATE budget_targets SET amount = ? WHERE id = ?').run(amount, (existing as { id: number }).id);
    } else {
      db.prepare('INSERT INTO budget_targets (trip_id, owner_id, amount) VALUES (?, ?, ?)').run(trip_id, ownerId, amount);
    }

    const row = ownerId === null
      ? db.prepare('SELECT * FROM budget_targets WHERE trip_id = ? AND owner_id IS NULL').get(trip_id)
      : db.prepare('SELECT * FROM budget_targets WHERE trip_id = ? AND owner_id = ?').get(trip_id, ownerId);
    reply.code(200);
    return row;
  });

  // --- Kategorien-Zielbudgets ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/category-targets', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    return db
      .prepare('SELECT * FROM budget_category_targets WHERE trip_id = ? ORDER BY category')
      .all(req.query.trip_id);
  });

  app.put<{ Body: CategoryTargetBody }>('/budget/category-targets', async (req) => {
    const { trip_id, category, amount } = req.body;
    db.prepare(
      `INSERT INTO budget_category_targets (trip_id, category, amount) VALUES (?, ?, ?)
       ON CONFLICT(trip_id, category) DO UPDATE SET amount = excluded.amount`,
    ).run(trip_id, category, amount);
    return db
      .prepare('SELECT * FROM budget_category_targets WHERE trip_id = ? AND category = ?')
      .get(trip_id, category);
  });

  app.delete<{ Params: { id: string } }>('/budget/category-targets/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM budget_category_targets WHERE id = ?').run(req.params.id);
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
