import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  link?: string;
  maps_link?: string;
  note?: string;
  status?: 'idea' | 'planned' | 'discarded';
  lat?: number;
  lng?: number;
  suggested_by_user_id?: number | null;
}

interface CommentBody {
  content: string;
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM ideas WHERE trip_id = ? ORDER BY id DESC').all(req.query.trip_id);
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { trip_id, title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id } = req.body;
    const result = db
      .prepare(
        `INSERT INTO ideas (trip_id, title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        title,
        image_url ?? null,
        link ?? null,
        maps_link ?? null,
        note ?? null,
        status ?? 'idea',
        lat ?? null,
        lng ?? null,
        suggested_by_user_id ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM ideas WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const { title, image_url, link, maps_link, note, status, lat, lng, suggested_by_user_id } = req.body;
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, link = ?, maps_link = ?, note = ?, status = ?, lat = ?, lng = ?, suggested_by_user_id = ?
         WHERE id = ?`,
      )
      .run(
        title,
        image_url ?? null,
        link ?? null,
        maps_link ?? null,
        note ?? null,
        status ?? 'idea',
        lat ?? null,
        lng ?? null,
        suggested_by_user_id ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/ideas/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  app.get<{ Querystring: { trip_id?: string } }>('/ideas/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT idea_likes.* FROM idea_likes
         JOIN ideas ON ideas.id = idea_likes.idea_id
         WHERE ideas.trip_id = ?`,
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/ideas/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT idea_comments.* FROM idea_comments
         JOIN ideas ON ideas.id = idea_comments.idea_id
         WHERE ideas.trip_id = ?
         ORDER BY idea_comments.created_at ASC, idea_comments.id ASC`,
      )
      .all(req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/ideas/:id/like', async (req, reply) => {
    const idea = db.prepare('SELECT id FROM ideas WHERE id = ?').get(req.params.id);
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });

    const existing = db
      .prepare('SELECT id FROM idea_likes WHERE idea_id = ? AND user_id = ?')
      .get(req.params.id, req.session.userId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM idea_likes WHERE id = ?').run(existing.id);
      return { liked: false };
    }

    db.prepare('INSERT INTO idea_likes (idea_id, user_id, created_at) VALUES (?, ?, ?)').run(
      req.params.id,
      req.session.userId,
      new Date().toISOString(),
    );
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>('/ideas/:id/comments', async (req, reply) => {
    const idea = db.prepare('SELECT id FROM ideas WHERE id = ?').get(req.params.id);
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });

    const result = db
      .prepare('INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM idea_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/ideas/comments/:id', async (req, reply) => {
    const comment = db.prepare('SELECT * FROM idea_comments WHERE id = ?').get(req.params.id) as
      | { id: number; author_id: number }
      | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM idea_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
