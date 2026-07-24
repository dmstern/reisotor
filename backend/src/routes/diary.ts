import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface EntryRow {
  id: number;
  author_id: number;
  title: string | null;
  content: string;
  images: string | null;
  created_at: string;
  updated_at: string | null;
}

interface EntryBody {
  title?: string;
  content: string;
  images?: string[];
}

interface CommentBody {
  content: string;
}

function serializeEntry(row: EntryRow) {
  return { ...row, images: row.images ? (JSON.parse(row.images) as string[]) : [] };
}

export const diaryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/diary', async () => {
    const rows = db.prepare('SELECT * FROM diary_entries ORDER BY created_at DESC, id DESC').all() as EntryRow[];
    return rows.map(serializeEntry);
  });

  app.get('/diary/likes', async () => {
    return db.prepare('SELECT * FROM diary_likes').all();
  });

  app.get('/diary/comments', async () => {
    return db.prepare('SELECT * FROM diary_comments ORDER BY created_at ASC, id ASC').all();
  });

  app.post<{ Body: EntryBody }>('/diary', async (req, reply) => {
    const { title, content, images } = req.body;
    const now = new Date().toISOString();
    const result = db
      .prepare('INSERT INTO diary_entries (author_id, title, content, images, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(req.session.userId, title ?? null, content, JSON.stringify(images ?? []), now);
    reply.code(201);
    const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(result.lastInsertRowid) as EntryRow;
    return serializeEntry(row);
  });

  app.put<{ Params: { id: string }; Body: EntryBody }>('/diary/:id', async (req, reply) => {
    const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as
      | EntryRow
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (entry.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Beitrag bearbeiten' });
    }

    const { title, content, images } = req.body;
    const now = new Date().toISOString();
    db.prepare('UPDATE diary_entries SET title = ?, content = ?, images = ?, updated_at = ? WHERE id = ?').run(
      title ?? null,
      content,
      JSON.stringify(images ?? []),
      now,
      req.params.id,
    );
    const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as EntryRow;
    return serializeEntry(row);
  });

  app.delete<{ Params: { id: string } }>('/diary/:id', async (req, reply) => {
    const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as
      | EntryRow
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (entry.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Beitrag löschen' });
    }
    db.prepare('DELETE FROM diary_entries WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/diary/:id/like', async (req, reply) => {
    const entry = db.prepare('SELECT id FROM diary_entries WHERE id = ?').get(req.params.id);
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });

    const existing = db
      .prepare('SELECT id FROM diary_likes WHERE entry_id = ? AND user_id = ?')
      .get(req.params.id, req.session.userId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM diary_likes WHERE id = ?').run(existing.id);
      return { liked: false };
    }

    db.prepare('INSERT INTO diary_likes (entry_id, user_id, created_at) VALUES (?, ?, ?)').run(
      req.params.id,
      req.session.userId,
      new Date().toISOString(),
    );
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>('/diary/:id/comments', async (req, reply) => {
    const entry = db.prepare('SELECT id FROM diary_entries WHERE id = ?').get(req.params.id);
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });

    const result = db
      .prepare('INSERT INTO diary_comments (entry_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/diary/comments/:id', async (req, reply) => {
    const comment = db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(req.params.id) as
      | { id: number; author_id: number }
      | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM diary_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
