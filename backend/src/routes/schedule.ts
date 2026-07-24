import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ScheduleBody {
  date: string;
  time?: string;
  title: string;
  note?: string;
  idea_id?: number | null;
}

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get('/schedule', async () => {
    return db.prepare('SELECT * FROM schedule_items ORDER BY date, time').all();
  });

  app.post<{ Body: ScheduleBody }>('/schedule', async (req, reply) => {
    const { date, time, title, note, idea_id } = req.body;
    const result = db
      .prepare('INSERT INTO schedule_items (date, time, title, note, idea_id) VALUES (?, ?, ?, ?, ?)')
      .run(date, time ?? null, title, note ?? null, idea_id ?? null);
    if (idea_id) {
      db.prepare("UPDATE ideas SET status = 'planned' WHERE id = ?").run(idea_id);
    }
    reply.code(201);
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ScheduleBody }>('/schedule/:id', async (req, reply) => {
    const { date, time, title, note, idea_id } = req.body;
    const result = db
      .prepare('UPDATE schedule_items SET date = ?, time = ?, title = ?, note = ?, idea_id = ? WHERE id = ?')
      .run(date, time ?? null, title, note ?? null, idea_id ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (idea_id) {
      db.prepare("UPDATE ideas SET status = 'planned' WHERE id = ?").run(idea_id);
    }
    return db.prepare('SELECT * FROM schedule_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM schedule_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
