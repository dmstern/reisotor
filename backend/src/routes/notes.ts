import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface NoteBody {
  trip_id: number;
  title?: string;
  content: string;
}

interface CommentBody {
  content: string;
}

export const notesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/notes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM notes WHERE trip_id = ? ORDER BY created_at DESC, id DESC')
      .all(req.query.trip_id);
  });

  app.post<{ Body: NoteBody }>('/notes', async (req, reply) => {
    const { trip_id, title, content } = req.body;
    const now = new Date().toISOString();
    const result = db
      .prepare('INSERT INTO notes (trip_id, title, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(trip_id, title ?? null, content, req.session.userId, now);
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

  app.get<{ Querystring: { trip_id?: string } }>('/notes/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT note_likes.* FROM note_likes
         JOIN notes ON notes.id = note_likes.note_id
         WHERE notes.trip_id = ?`,
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/notes/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT note_comments.* FROM note_comments
         JOIN notes ON notes.id = note_comments.note_id
         WHERE notes.trip_id = ?
         ORDER BY note_comments.created_at ASC, note_comments.id ASC`,
      )
      .all(req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/notes/:id/like', async (req, reply) => {
    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.id);
    if (!note) return reply.code(404).send({ error: 'Nicht gefunden' });

    const existing = db
      .prepare('SELECT id FROM note_likes WHERE note_id = ? AND user_id = ?')
      .get(req.params.id, req.session.userId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM note_likes WHERE id = ?').run(existing.id);
      return { liked: false };
    }

    db.prepare('INSERT INTO note_likes (note_id, user_id, created_at) VALUES (?, ?, ?)').run(
      req.params.id,
      req.session.userId,
      new Date().toISOString(),
    );
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>('/notes/:id/comments', async (req, reply) => {
    const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.id);
    if (!note) return reply.code(404).send({ error: 'Nicht gefunden' });

    const result = db
      .prepare('INSERT INTO note_comments (note_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM note_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/notes/comments/:id', async (req, reply) => {
    const comment = db.prepare('SELECT * FROM note_comments WHERE id = ?').get(req.params.id) as
      | { id: number; author_id: number }
      | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM note_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
