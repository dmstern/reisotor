import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
function requireTripId(query, reply) {
    if (!query.trip_id) {
        reply.code(400).send({ error: 'trip_id erforderlich' });
        return false;
    }
    return true;
}
export const budgetRoutes = async (app) => {
    // --- Ausgaben (Bezahlungen) ---
    app.get('/budget', async (req, reply) => {
        if (!requireTripId(req.query, reply))
            return;
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM budget_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC')
            .all(req.query.trip_id);
    });
    app.post('/budget', async (req, reply) => {
        const { trip_id, title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const result = db
            .prepare(`INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(trip_id, title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null, budget_id ?? null);
        recordActivity(trip_id, 'budget', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/budget/:id', async (req, reply) => {
        const existingExpense = db.prepare('SELECT trip_id FROM budget_items WHERE id = ?').get(req.params.id);
        if (!existingExpense)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingExpense.trip_id, req.session.userId))
            return;
        const { title, category, amount, paid_by_user_id, date, note, budget_id } = req.body;
        const result = db
            .prepare(`UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, note = ?, budget_id = ?
         WHERE id = ?`)
            .run(title, category ?? null, amount, paid_by_user_id ?? null, date ?? null, note ?? null, budget_id ?? null, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingExpense.trip_id, 'budget', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM budget_items WHERE id = ?').get(req.params.id);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    app.delete('/budget/:id', async (req, reply) => {
        const existingExpense = db.prepare('SELECT trip_id FROM budget_items WHERE id = ?').get(req.params.id);
        if (!existingExpense)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingExpense.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(new Date().toISOString(), req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingExpense.trip_id, 'budget', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
    // --- Budgets (persönlich oder geteilt) ---
    app.get('/budget/budgets', async (req, reply) => {
        if (!requireTripId(req.query, reply))
            return;
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db.prepare('SELECT * FROM budgets WHERE trip_id = ? ORDER BY owner_id IS NOT NULL, id').all(req.query.trip_id);
    });
    app.post('/budget/budgets', async (req, reply) => {
        const { trip_id, name, owner_id } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        if (!name?.trim())
            return reply.code(400).send({ error: 'Name erforderlich' });
        const result = db
            .prepare('INSERT INTO budgets (trip_id, name, owner_id) VALUES (?, ?, ?)')
            .run(trip_id, name.trim(), owner_id ?? null);
        recordActivity(trip_id, 'budget', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM budgets WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/budget/budgets/:id', async (req, reply) => {
        const existingBudget = db.prepare('SELECT trip_id FROM budgets WHERE id = ?').get(req.params.id);
        if (!existingBudget)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingBudget.trip_id, req.session.userId))
            return;
        const { name, owner_id } = req.body;
        if (!name?.trim())
            return reply.code(400).send({ error: 'Name erforderlich' });
        const result = db
            .prepare('UPDATE budgets SET name = ?, owner_id = ? WHERE id = ?')
            .run(name.trim(), owner_id ?? null, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingBudget.trip_id, 'budget', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
    });
    app.delete('/budget/budgets/:id', async (req, reply) => {
        const existingBudget = db.prepare('SELECT trip_id FROM budgets WHERE id = ?').get(req.params.id);
        if (!existingBudget)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingBudget.trip_id, req.session.userId))
            return;
        const result = db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingBudget.trip_id, 'budget', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
    // --- Kategorien-Aufteilung je Budget ---
    app.get('/budget/allocations', async (req, reply) => {
        if (!requireTripId(req.query, reply))
            return;
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT a.* FROM budget_allocations a
         JOIN budgets b ON b.id = a.budget_id
         WHERE b.trip_id = ?
         ORDER BY a.category`)
            .all(req.query.trip_id);
    });
    app.put('/budget/allocations', async (req, reply) => {
        const { budget_id, category, amount } = req.body;
        const parentBudget = db.prepare('SELECT trip_id FROM budgets WHERE id = ?').get(budget_id);
        if (!parentBudget)
            return reply.code(404).send({ error: 'Budget nicht gefunden' });
        if (!requireTripMember(reply, parentBudget.trip_id, req.session.userId))
            return;
        if (!category?.trim())
            return reply.code(400).send({ error: 'Kategorie erforderlich' });
        db.prepare(`INSERT INTO budget_allocations (budget_id, category, amount) VALUES (?, ?, ?)
       ON CONFLICT(budget_id, category) DO UPDATE SET amount = excluded.amount`).run(budget_id, category.trim(), amount || 0);
        return db
            .prepare('SELECT * FROM budget_allocations WHERE budget_id = ? AND category = ?')
            .get(budget_id, category.trim());
    });
    app.delete('/budget/allocations/:id', async (req, reply) => {
        const allocation = db
            .prepare(`SELECT budget_allocations.id, budgets.trip_id FROM budget_allocations
         JOIN budgets ON budgets.id = budget_allocations.budget_id
         WHERE budget_allocations.id = ?`)
            .get(req.params.id);
        if (!allocation)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, allocation.trip_id, req.session.userId))
            return;
        const result = db.prepare('DELETE FROM budget_allocations WHERE id = ?').run(req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        return reply.code(204).send();
    });
    // --- Überweisungen (Schulden begleichen) ---
    app.get('/budget/transfers', async (req, reply) => {
        if (!requireTripId(req.query, reply))
            return;
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM budget_transfers WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date DESC, id DESC')
            .all(req.query.trip_id);
    });
    app.post('/budget/transfers', async (req, reply) => {
        const { trip_id, from_user_id, to_user_id, amount, date, note } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const result = db
            .prepare('INSERT INTO budget_transfers (trip_id, from_user_id, to_user_id, amount, date, note) VALUES (?, ?, ?, ?, ?, ?)')
            .run(trip_id, from_user_id, to_user_id, amount, date ?? null, note ?? null);
        recordActivity(trip_id, 'budget', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/budget/transfers/:id', async (req, reply) => {
        const existingTransfer = db.prepare('SELECT trip_id FROM budget_transfers WHERE id = ?').get(req.params.id);
        if (!existingTransfer)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingTransfer.trip_id, req.session.userId))
            return;
        const { from_user_id, to_user_id, amount, date, note } = req.body;
        const result = db
            .prepare('UPDATE budget_transfers SET from_user_id = ?, to_user_id = ?, amount = ?, date = ?, note = ? WHERE id = ?')
            .run(from_user_id, to_user_id, amount, date ?? null, note ?? null, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingTransfer.trip_id, 'budget', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM budget_transfers WHERE id = ?').get(req.params.id);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    app.delete('/budget/transfers/:id', async (req, reply) => {
        const existingTransfer = db.prepare('SELECT trip_id FROM budget_transfers WHERE id = ?').get(req.params.id);
        if (!existingTransfer)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingTransfer.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('UPDATE budget_transfers SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(new Date().toISOString(), req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingTransfer.trip_id, 'budget', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
};
