import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
export const todosRoutes = async (app) => {
    app.get('/todos', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM todo_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY done, due_date IS NULL, due_date, id DESC')
            .all(req.query.trip_id);
    });
    app.post('/todos', async (req, reply) => {
        const { trip_id, title, assigned_to_user_id, due_date, priority, note, done } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const result = db
            .prepare(`INSERT INTO todo_items (trip_id, title, assigned_to_user_id, due_date, priority, note, done)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(trip_id, title, assigned_to_user_id ?? null, due_date ?? null, priority ?? 'medium', note ?? null, done ? 1 : 0);
        recordActivity(trip_id, 'todos', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM todo_items WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/todos/:id', async (req, reply) => {
        const existingItem = db.prepare('SELECT trip_id FROM todo_items WHERE id = ?').get(req.params.id);
        if (!existingItem)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingItem.trip_id, req.session.userId))
            return;
        const { title, assigned_to_user_id, due_date, priority, note, done } = req.body;
        const result = db
            .prepare(`UPDATE todo_items SET title = ?, assigned_to_user_id = ?, due_date = ?, priority = ?, note = ?, done = ?
         WHERE id = ?`)
            .run(title, assigned_to_user_id ?? null, due_date ?? null, priority ?? 'medium', note ?? null, done ? 1 : 0, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingItem.trip_id, 'todos', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM todo_items WHERE id = ?').get(req.params.id);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    app.delete('/todos/:id', async (req, reply) => {
        const existingItem = db.prepare('SELECT trip_id FROM todo_items WHERE id = ?').get(req.params.id);
        if (!existingItem)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingItem.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('UPDATE todo_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(new Date().toISOString(), req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingItem.trip_id, 'todos', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
};
