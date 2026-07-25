import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface TodoBody {
  trip_id: number;
  title: string;
  assigned_to_user_id?: number | null;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  note?: string;
  done?: boolean;
  period?: 'before' | 'during' | null;
}

export const todosRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/todos', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM todo_items WHERE trip_id = ? ORDER BY done, due_date IS NULL, due_date, id DESC')
      .all(req.query.trip_id);
  });

  app.post<{ Body: TodoBody }>('/todos', async (req, reply) => {
    const { trip_id, title, assigned_to_user_id, due_date, priority, note, done, period } = req.body;
    const result = db
      .prepare(
        `INSERT INTO todo_items (trip_id, title, assigned_to_user_id, due_date, priority, note, done, period)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        title,
        assigned_to_user_id ?? null,
        due_date ?? null,
        priority ?? 'medium',
        note ?? null,
        done ? 1 : 0,
        period ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM todo_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TodoBody }>('/todos/:id', async (req, reply) => {
    const { title, assigned_to_user_id, due_date, priority, note, done, period } = req.body;
    const result = db
      .prepare(
        `UPDATE todo_items SET title = ?, assigned_to_user_id = ?, due_date = ?, priority = ?, note = ?, done = ?, period = ?
         WHERE id = ?`,
      )
      .run(
        title,
        assigned_to_user_id ?? null,
        due_date ?? null,
        priority ?? 'medium',
        note ?? null,
        done ? 1 : 0,
        period ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM todo_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/todos/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM todo_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
