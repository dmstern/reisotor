import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface AccommodationBody {
  name: string;
  address?: string;
  link?: string;
  maps_link?: string;
  start_date?: string;
  end_date?: string;
  checkin?: string;
  checkout?: string;
  contact?: string;
  note?: string;
  lat?: number;
  lng?: number;
  amount?: number;
  paid_by_user_id?: number | null;
}

interface AccommodationRow {
  id: number;
  budget_expense_id: number | null;
}

/** Bestimmt, wie die verknüpfte Budget-Ausgabe aussehen soll, ohne bereits zu löschen –
 *  eine ggf. verwaiste alte Ausgabe wird erst gelöscht, NACHDEM die accommodation-Zeile
 *  nicht mehr per Foreign Key darauf verweist (sonst SQLITE_CONSTRAINT_FOREIGNKEY). */
function planBudgetExpense(existingBudgetExpenseId: number | null, body: AccommodationBody) {
  const hasAmount = body.amount != null && body.amount > 0 && body.paid_by_user_id != null;

  if (!hasAmount) {
    return { budgetExpenseId: null as number | null, staleIdToDelete: existingBudgetExpenseId };
  }

  if (existingBudgetExpenseId) {
    db.prepare(
      'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ? WHERE id = ?',
    ).run(body.name, 'Unterkunft', body.amount, body.paid_by_user_id, body.start_date ?? null, existingBudgetExpenseId);
    return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
  }

  const result = db
    .prepare(
      `INSERT INTO budget_items (title, category, amount, paid_by_user_id, date, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(body.name, 'Unterkunft', body.amount, body.paid_by_user_id, body.start_date ?? null, 'Automatisch aus Unterkunft-Eintrag');
  return { budgetExpenseId: result.lastInsertRowid as number, staleIdToDelete: null };
}

export const accommodationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/accommodation', async () => {
    return db.prepare('SELECT * FROM accommodation ORDER BY start_date, id').all();
  });

  app.post<{ Body: AccommodationBody }>('/accommodation', async (req, reply) => {
    const body = req.body;
    const { budgetExpenseId } = planBudgetExpense(null, body);

    const result = db
      .prepare(
        `INSERT INTO accommodation
          (name, address, link, maps_link, start_date, end_date, checkin, checkout, contact, note, lat, lng,
           amount, paid_by_user_id, budget_expense_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body.name,
        body.address ?? null,
        body.link ?? null,
        body.maps_link ?? null,
        body.start_date ?? null,
        body.end_date ?? null,
        body.checkin ?? null,
        body.checkout ?? null,
        body.contact ?? null,
        body.note ?? null,
        body.lat ?? null,
        body.lng ?? null,
        body.amount ?? null,
        body.paid_by_user_id ?? null,
        budgetExpenseId,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM accommodation WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: AccommodationBody }>('/accommodation/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM accommodation WHERE id = ?').get(req.params.id) as
      | AccommodationRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    const body = req.body;
    const { budgetExpenseId, staleIdToDelete } = planBudgetExpense(existing.budget_expense_id, body);

    db.prepare(
      `UPDATE accommodation SET name = ?, address = ?, link = ?, maps_link = ?, start_date = ?, end_date = ?,
         checkin = ?, checkout = ?, contact = ?, note = ?, lat = ?, lng = ?, amount = ?, paid_by_user_id = ?,
         budget_expense_id = ?
       WHERE id = ?`,
    ).run(
      body.name,
      body.address ?? null,
      body.link ?? null,
      body.maps_link ?? null,
      body.start_date ?? null,
      body.end_date ?? null,
      body.checkin ?? null,
      body.checkout ?? null,
      body.contact ?? null,
      body.note ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.amount ?? null,
      body.paid_by_user_id ?? null,
      budgetExpenseId,
      req.params.id,
    );

    // Erst jetzt löschen: die accommodation-Zeile verweist nicht mehr auf die alte Ausgabe.
    if (staleIdToDelete) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(staleIdToDelete);
    }

    return db.prepare('SELECT * FROM accommodation WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/accommodation/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM accommodation WHERE id = ?').get(req.params.id) as
      | AccommodationRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    db.prepare('DELETE FROM accommodation WHERE id = ?').run(req.params.id);
    if (existing.budget_expense_id) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(existing.budget_expense_id);
    }
    return reply.code(204).send();
  });
};
