import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
export const shoppingRoutes = async (app) => {
    app.get('/shopping', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM shopping_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY checked, id DESC')
            .all(req.query.trip_id);
    });
    app.post('/shopping', async (req, reply) => {
        const { trip_id, label, assigned_to_user_id, checked, link, note, shop, period } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const result = db
            .prepare('INSERT INTO shopping_items (trip_id, label, assigned_to_user_id, checked, link, note, shop, period) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(trip_id, label, assigned_to_user_id ?? null, checked ? 1 : 0, link ?? null, note ?? null, shop ?? null, period ?? null);
        recordActivity(trip_id, 'shopping', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/shopping/:id', async (req, reply) => {
        const existingItem = db
            .prepare('SELECT trip_id FROM shopping_items WHERE id = ?')
            .get(req.params.id);
        if (!existingItem)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingItem.trip_id, req.session.userId))
            return;
        const { label, assigned_to_user_id, checked, link, note, shop, period } = req.body;
        const result = db
            .prepare('UPDATE shopping_items SET label = ?, assigned_to_user_id = ?, checked = ?, link = ?, note = ?, shop = ?, period = ? WHERE id = ?')
            .run(label, assigned_to_user_id ?? null, checked ? 1 : 0, link ?? null, note ?? null, shop ?? null, period ?? null, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingItem.trip_id, 'shopping', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(req.params.id);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    app.delete('/shopping/:id', async (req, reply) => {
        const existingItem = db
            .prepare('SELECT trip_id FROM shopping_items WHERE id = ?')
            .get(req.params.id);
        if (!existingItem)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingItem.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('UPDATE shopping_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(new Date().toISOString(), req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingItem.trip_id, 'shopping', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
};
