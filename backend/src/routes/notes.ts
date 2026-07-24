import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface NoteBody {
  title?: string;
  content: string;
}

export const notesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/notes', async () => {
    return db.prepare('SELECT * FROM notes ORDER BY created_at DESC, id DESC').all();
  });

  app.post<{ Body: NoteBody }>('/notes', async (req, reply) => {
    const { title, content } = req.body;
    const now = new Date().toISOString();
    const result = db
      .prepare('INSERT INTO notes (title, content, created_by, created_at) VALUES (?, ?, ?, ?)')
      .run(title ?? null, content, req.session.userId, now);
    reply.code(201);
    return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: NoteBody }>('/notes/:id', async (req, reply) => {
    const { title, content } = req.body;
    const now = new Date().toISOString();
    const result = db
      .prepare('UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?')
      .run(title ?? null, content, now, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/notes/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
