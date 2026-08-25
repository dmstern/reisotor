import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { db } from '../db/index.js';
import { isTripMember, requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

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
  target_amount?: number | null;
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

function requireTripId(
  query: { trip_id?: string },
  reply: { code: (n: number) => { send: (b: unknown) => unknown } }
) {
  if (!query.trip_id) {
    reply.code(400).send({ error: 'trip_id erforderlich' });
    return false;
  }
  return true;
}

// Ein Budget ist für alle sichtbar/veränderbar, deren owner_id NULL ist (geteilt); ein persönliches
// Budget (owner_id gesetzt) nur für seinen Besitzer. "Echte" Privatsphäre statt nur eines UI-Labels
// - siehe CLAUDE.md-Plan zur Budget-Überarbeitung.
function isBudgetVisibleTo(
  budget: { owner_id: number | null },
  userId: number | undefined
): boolean {
  return budget.owner_id == null || budget.owner_id === userId;
}

// Zentraler Zugriffs-Check für Ausgaben, die (optional) einem Budget-Topf zugeordnet sind: ohne
// budget_id gibt es nichts zu prüfen; mit budget_id muss der Topf existieren und für die anfragende
// Person sichtbar sein (sonst könnte man z. B. eine Ausgabe in einen fremden privaten Topf
// verschieben oder eine dort bereits verknüpfte Ausgabe trotzdem bearbeiten/löschen). Analag zu
// requireTripMember: sendet bei `false` bereits selbst eine Antwort, Aufrufer müssen dann sofort
// zurückkehren.
function requireBudgetAccessIfLinked(
  reply: FastifyReply,
  budgetId: number | null | undefined,
  userId: number | undefined
): boolean {
  if (budgetId == null) return true;
  const budget = db.prepare('SELECT owner_id FROM budgets WHERE id = ?').get(budgetId) as
    { owner_id: number | null } | undefined;
  if (!budget) {
    reply.code(400).send({ error: 'Budget nicht gefunden' });
    return false;
  }
  if (!isBudgetVisibleTo(budget, userId)) {
    reply.code(403).send({ error: 'Kein Zugriff auf dieses Budget' });
    return false;
  }
  return true;
}

export const budgetRoutes: FastifyPluginAsync = async (app) => {
  // --- Ausgaben (Bezahlungen) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    // LEFT JOIN, da budget_id NULL sein kann (Alt-Ausgaben/nicht zugeordnet - gelten als geteilt).
    // Eine Ausgabe ist sichtbar, wenn sie keinem Budget zugeordnet ist, einem geteilten Budget
    // zugeordnet ist, oder einem eigenen privaten Budget zugeordnet ist.
    return db
      .prepare(
        `SELECT bi.* FROM budget_items bi
         LEFT JOIN budgets b ON b.id = bi.budget_id
         WHERE bi.trip_id = ? AND bi.deleted_at IS NULL
           AND (bi.budget_id IS NULL OR b.owner_id IS NULL OR b.owner_id = ?)
         ORDER BY bi.date DESC, bi.id DESC`
      )
      .all(req.query.trip_id, req.session.userId ?? null);
  });

  app.post<{ Body: ExpenseBody }>('/budget', async (req, reply) => {
    const { trip_id, title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    if (!(amount > 0)) return reply.code(400).send({ error: 'Betrag muss größer als 0 sein' });
    if (!requireBudgetAccessIfLinked(reply, budget_id, req.session.userId)) return;
    const result = db
      .prepare(
        `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        trip_id,
        title,
        category ?? null,
        amount,
        paid_by_user_id ?? null,
        date ?? null,
        note ?? null,
        budget_id ?? null
      );
    recordActivity(
      trip_id,
      'budget',
      result.lastInsertRowid as number,
      'created',
      req.session.userId!
    );
    reply.code(201);
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ExpenseBody }>('/budget/:id', async (req, reply) => {
    const existingExpense = db
      .prepare('SELECT trip_id, budget_id FROM budget_items WHERE id = ?')
      .get(req.params.id) as { trip_id: number; budget_id: number | null } | undefined;
    if (!existingExpense) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingExpense.trip_id, req.session.userId)) return;
    if (!requireBudgetAccessIfLinked(reply, existingExpense.budget_id, req.session.userId)) return;

    const { title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
    if (!(amount > 0)) return reply.code(400).send({ error: 'Betrag muss größer als 0 sein' });
    if (!requireBudgetAccessIfLinked(reply, budget_id, req.session.userId)) return;
    const result = db
      .prepare(
        `UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, note = ?, budget_id = ?
         WHERE id = ?`
      )
      .run(
        title,
        category ?? null,
        amount,
        paid_by_user_id ?? null,
        date ?? null,
        note ?? null,
        budget_id ?? null,
        req.params.id
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingExpense.trip_id,
      'budget',
      Number(req.params.id),
      'updated',
      req.session.userId!
    );
    return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen.
  app.delete<{ Params: { id: string } }>('/budget/:id', async (req, reply) => {
    const existingExpense = db
      .prepare('SELECT trip_id, budget_id FROM budget_items WHERE id = ?')
      .get(req.params.id) as { trip_id: number; budget_id: number | null } | undefined;
    if (!existingExpense) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingExpense.trip_id, req.session.userId)) return;
    if (!requireBudgetAccessIfLinked(reply, existingExpense.budget_id, req.session.userId)) return;

    const result = db
      .prepare('UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingExpense.trip_id,
      'budget',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });

  // --- Budgets (persönlich oder geteilt) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/budgets', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        'SELECT * FROM budgets WHERE trip_id = ? AND (owner_id IS NULL OR owner_id = ?) ORDER BY owner_id IS NOT NULL, id'
      )
      .all(req.query.trip_id, req.session.userId ?? null);
  });

  app.post<{ Body: BudgetBody }>('/budget/budgets', async (req, reply) => {
    const { trip_id, name, owner_id, target_amount } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    if (!name?.trim()) return reply.code(400).send({ error: 'Name erforderlich' });
    if (target_amount != null && !(target_amount > 0)) {
      return reply.code(400).send({ error: 'Zielbetrag muss positiv sein oder leer bleiben' });
    }
    const result = db
      .prepare('INSERT INTO budgets (trip_id, name, owner_id, target_amount) VALUES (?, ?, ?, ?)')
      .run(trip_id, name.trim(), owner_id ?? null, target_amount ?? null);
    recordActivity(
      trip_id,
      'budget',
      result.lastInsertRowid as number,
      'created',
      req.session.userId!
    );
    reply.code(201);
    return db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: BudgetBody }>(
    '/budget/budgets/:id',
    async (req, reply) => {
      const existingBudget = db
        .prepare('SELECT trip_id, owner_id FROM budgets WHERE id = ?')
        .get(req.params.id) as { trip_id: number; owner_id: number | null } | undefined;
      if (!existingBudget) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, existingBudget.trip_id, req.session.userId)) return;
      if (!isBudgetVisibleTo(existingBudget, req.session.userId)) {
        return reply.code(403).send({ error: 'Kein Zugriff auf dieses Budget' });
      }

      const { name, owner_id, target_amount } = req.body;
      if (!name?.trim()) return reply.code(400).send({ error: 'Name erforderlich' });
      if (target_amount != null && !(target_amount > 0)) {
        return reply.code(400).send({ error: 'Zielbetrag muss positiv sein oder leer bleiben' });
      }
      const result = db
        .prepare('UPDATE budgets SET name = ?, owner_id = ?, target_amount = ? WHERE id = ?')
        .run(name.trim(), owner_id ?? null, target_amount ?? null, req.params.id);
      if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
      recordActivity(
        existingBudget.trip_id,
        'budget',
        Number(req.params.id),
        'updated',
        req.session.userId!
      );
      return db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    }
  );

  app.delete<{ Params: { id: string } }>('/budget/budgets/:id', async (req, reply) => {
    const existingBudget = db
      .prepare('SELECT trip_id, owner_id FROM budgets WHERE id = ?')
      .get(req.params.id) as { trip_id: number; owner_id: number | null } | undefined;
    if (!existingBudget) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingBudget.trip_id, req.session.userId)) return;
    if (!isBudgetVisibleTo(existingBudget, req.session.userId)) {
      return reply.code(403).send({ error: 'Kein Zugriff auf dieses Budget' });
    }

    const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingBudget.trip_id,
      'budget',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });

  // --- Kategorien-Aufteilung je Budget ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/allocations', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT a.* FROM budget_allocations a
         JOIN budgets b ON b.id = a.budget_id
         WHERE b.trip_id = ? AND (b.owner_id IS NULL OR b.owner_id = ?)
         ORDER BY a.category`
      )
      .all(req.query.trip_id, req.session.userId ?? null);
  });

  app.put<{ Body: AllocationBody }>('/budget/allocations', async (req, reply) => {
    const { budget_id, category, amount } = req.body;
    const parentBudget = db
      .prepare('SELECT trip_id, owner_id FROM budgets WHERE id = ?')
      .get(budget_id) as { trip_id: number; owner_id: number | null } | undefined;
    if (!parentBudget) return reply.code(404).send({ error: 'Budget nicht gefunden' });
    if (!requireTripMember(reply, parentBudget.trip_id, req.session.userId)) return;
    if (!isBudgetVisibleTo(parentBudget, req.session.userId)) {
      return reply.code(403).send({ error: 'Kein Zugriff auf dieses Budget' });
    }
    if (!category?.trim()) return reply.code(400).send({ error: 'Kategorie erforderlich' });
    if (amount != null && amount < 0)
      return reply.code(400).send({ error: 'Betrag darf nicht negativ sein' });
    db.prepare(
      `INSERT INTO budget_allocations (budget_id, category, amount) VALUES (?, ?, ?)
       ON CONFLICT(budget_id, category) DO UPDATE SET amount = excluded.amount`
    ).run(budget_id, category.trim(), amount || 0);
    return db
      .prepare('SELECT * FROM budget_allocations WHERE budget_id = ? AND category = ?')
      .get(budget_id, category.trim());
  });

  app.delete<{ Params: { id: string } }>('/budget/allocations/:id', async (req, reply) => {
    const allocation = db
      .prepare(
        `SELECT budget_allocations.id, budgets.trip_id, budgets.owner_id FROM budget_allocations
         JOIN budgets ON budgets.id = budget_allocations.budget_id
         WHERE budget_allocations.id = ?`
      )
      .get(req.params.id) as { id: number; trip_id: number; owner_id: number | null } | undefined;
    if (!allocation) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, allocation.trip_id, req.session.userId)) return;
    if (!isBudgetVisibleTo(allocation, req.session.userId)) {
      return reply.code(403).send({ error: 'Kein Zugriff auf dieses Budget' });
    }

    const result = db.prepare('DELETE FROM budget_allocations WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Überweisungen (Schulden begleichen) ---

  app.get<{ Querystring: { trip_id?: string } }>('/budget/transfers', async (req, reply) => {
    if (!requireTripId(req.query, reply)) return;
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        'SELECT * FROM budget_transfers WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC'
      )
      .all(req.query.trip_id);
  });

  app.post<{ Body: TransferBody }>('/budget/transfers', async (req, reply) => {
    const { trip_id, from_user_id, to_user_id, amount, date, note } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    if (!(amount > 0)) return reply.code(400).send({ error: 'Betrag muss größer als 0 sein' });
    if (from_user_id === to_user_id) {
      return reply.code(400).send({ error: 'Von und An dürfen nicht identisch sein' });
    }
    if (!isTripMember(trip_id, from_user_id) || !isTripMember(trip_id, to_user_id)) {
      return reply.code(400).send({ error: 'Von/An müssen Mitglieder dieses Urlaubs sein' });
    }
    const result = db
      .prepare(
        'INSERT INTO budget_transfers (trip_id, from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(trip_id, from_user_id, to_user_id, amount, date ?? null, note ?? null);
    recordActivity(
      trip_id,
      'budget',
      result.lastInsertRowid as number,
      'created',
      req.session.userId!
    );
    reply.code(201);
    return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TransferBody }>(
    '/budget/transfers/:id',
    async (req, reply) => {
      const existingTransfer = db
        .prepare('SELECT trip_id FROM budget_transfers WHERE id = ?')
        .get(req.params.id) as { trip_id: number } | undefined;
      if (!existingTransfer) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, existingTransfer.trip_id, req.session.userId)) return;

      const { from_user_id, to_user_id, amount, date, note } = req.body;
      if (!(amount > 0)) return reply.code(400).send({ error: 'Betrag muss größer als 0 sein' });
      if (from_user_id === to_user_id) {
        return reply.code(400).send({ error: 'Von und An dürfen nicht identisch sein' });
      }
      if (
        !isTripMember(existingTransfer.trip_id, from_user_id) ||
        !isTripMember(existingTransfer.trip_id, to_user_id)
      ) {
        return reply.code(400).send({ error: 'Von/An müssen Mitglieder dieses Urlaubs sein' });
      }
      const result = db
        .prepare(
          'UPDATE budget_transfers SET from_user_id = ?, to_user_id = ?, amount = ?, date = ?, note = ? WHERE id = ?'
        )
        .run(from_user_id, to_user_id, amount, date ?? null, note ?? null, req.params.id);
      if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
      recordActivity(
        existingTransfer.trip_id,
        'budget',
        Number(req.params.id),
        'updated',
        req.session.userId!
      );
      return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(req.params.id);
    }
  );

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen.
  app.delete<{ Params: { id: string } }>('/budget/transfers/:id', async (req, reply) => {
    const existingTransfer = db
      .prepare('SELECT trip_id FROM budget_transfers WHERE id = ?')
      .get(req.params.id) as { trip_id: number } | undefined;
    if (!existingTransfer) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingTransfer.trip_id, req.session.userId)) return;

    const result = db
      .prepare('UPDATE budget_transfers SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(
      existingTransfer.trip_id,
      'budget',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });
};
