import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface TravelBody {
  trip_id: number;
  title: string;
  type?: string;
  from_location?: string;
  to_location?: string;
  date?: string;
  departure_time?: string;
  checkin_info?: string;
  amount?: number;
  paid_by_user_id?: number | null;
  luggage?: string;
  seat?: string;
  link?: string;
  note?: string;
}

interface TravelRow {
  id: number;
  trip_id: number;
  title: string;
  amount: number | null;
  paid_by_user_id: number | null;
  date: string | null;
  budget_expense_id: number | null;
}

/** Bestimmt, wie die verknüpfte Budget-Ausgabe aussehen soll, ohne bereits zu löschen –
 *  eine ggf. verwaiste alte Ausgabe wird erst gelöscht, NACHDEM die travel_items-Zeile
 *  nicht mehr per Foreign Key darauf verweist (sonst SQLITE_CONSTRAINT_FOREIGNKEY). */
function planBudgetExpense(tripId: number, existingBudgetExpenseId: number | null, body: TravelBody) {
  const hasAmount = body.amount != null && body.amount > 0 && body.paid_by_user_id != null;

  if (!hasAmount) {
    return { budgetExpenseId: null as number | null, staleIdToDelete: existingBudgetExpenseId };
  }

  if (existingBudgetExpenseId) {
    db.prepare(
      'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ? WHERE id = ?',
    ).run(body.title, 'Transport', body.amount, body.paid_by_user_id, body.date ?? null, existingBudgetExpenseId);
    return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
  }

  const result = db
    .prepare(
      `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(tripId, body.title, 'Transport', body.amount, body.paid_by_user_id, body.date ?? null, 'Automatisch aus Reise-Eintrag');
  return { budgetExpenseId: result.lastInsertRowid as number, staleIdToDelete: null };
}

export const travelRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/travel', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM travel_items WHERE trip_id = ? ORDER BY date, id').all(req.query.trip_id);
  });

  app.post<{ Body: TravelBody }>('/travel', async (req, reply) => {
    const body = req.body;
    const { budgetExpenseId } = planBudgetExpense(body.trip_id, null, body);

    const result = db
      .prepare(
        `INSERT INTO travel_items
          (trip_id, title, type, from_location, to_location, date, departure_time, checkin_info, amount,
           paid_by_user_id, luggage, seat, link, note, budget_expense_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body.trip_id,
        body.title,
        body.type ?? null,
        body.from_location ?? null,
        body.to_location ?? null,
        body.date ?? null,
        body.departure_time ?? null,
        body.checkin_info ?? null,
        body.amount ?? null,
        body.paid_by_user_id ?? null,
        body.luggage ?? null,
        body.seat ?? null,
        body.link ?? null,
        body.note ?? null,
        budgetExpenseId,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM travel_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TravelBody }>('/travel/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id) as
      | TravelRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    const body = req.body;
    const { budgetExpenseId, staleIdToDelete } = planBudgetExpense(existing.trip_id, existing.budget_expense_id, body);

    db.prepare(
      `UPDATE travel_items SET title = ?, type = ?, from_location = ?, to_location = ?, date = ?,
         departure_time = ?, checkin_info = ?, amount = ?, paid_by_user_id = ?, luggage = ?, seat = ?,
         link = ?, note = ?, budget_expense_id = ?
       WHERE id = ?`,
    ).run(
      body.title,
      body.type ?? null,
      body.from_location ?? null,
      body.to_location ?? null,
      body.date ?? null,
      body.departure_time ?? null,
      body.checkin_info ?? null,
      body.amount ?? null,
      body.paid_by_user_id ?? null,
      body.luggage ?? null,
      body.seat ?? null,
      body.link ?? null,
      body.note ?? null,
      budgetExpenseId,
      req.params.id,
    );

    // Erst jetzt löschen: die travel_items-Zeile verweist nicht mehr auf die alte Ausgabe.
    if (staleIdToDelete) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(staleIdToDelete);
    }

    return db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/travel/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id) as
      | TravelRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    db.prepare('DELETE FROM travel_items WHERE id = ?').run(req.params.id);
    if (existing.budget_expense_id) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(existing.budget_expense_id);
    }
    return reply.code(204).send();
  });
};
