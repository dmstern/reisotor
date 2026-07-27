import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  note?: string;
  date?: string;
  spot_ids?: number[];
}

interface IdeaRow {
  id: number;
  [key: string]: unknown;
}

interface CommentBody {
  content: string;
}

// Stationen eines Ausflugs (Batch 13, Reihenfolge/Mehrfachbesuche nachgerüstet): welche Spots
// gehören dazu, in welcher Reihenfolge. Wird bei jedem Anlegen/Bearbeiten komplett neu geschrieben
// (einfacher als Diffing) – kleine Anzahl Zeilen pro Ausflug. `position` statt der Zeilen-Id
// bestimmt die Reihenfolge, damit derselbe Spot mehrfach vorkommen darf (z. B. Start UND Ende an
// der Unterkunft für einen Rundgang).
function syncExcursionSpots(ideaId: number, spotIds: number[]) {
  db.prepare('DELETE FROM excursion_spots WHERE idea_id = ?').run(ideaId);
  const insert = db.prepare('INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)');
  spotIds.forEach((spotId, index) => {
    insert.run(ideaId, spotId, index);
  });
}

function spotIdsFor(ideaIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (!ideaIds.length) return map;
  const placeholders = ideaIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT idea_id, spot_id FROM excursion_spots WHERE idea_id IN (${placeholders}) ORDER BY idea_id, position`,
    )
    .all(...ideaIds) as { idea_id: number; spot_id: number }[];
  for (const row of rows) {
    const list = map.get(row.idea_id) ?? [];
    list.push(row.spot_id);
    map.set(row.idea_id, list);
  }
  return map;
}

function serializeIdea(row: IdeaRow, spotIds: number[]) {
  return { ...row, spot_ids: spotIds };
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    const rows = db.prepare('SELECT * FROM ideas WHERE trip_id = ? ORDER BY id DESC').all(req.query.trip_id) as IdeaRow[];
    const spotIds = spotIdsFor(rows.map((r) => r.id));
    return rows.map((row) => serializeIdea(row, spotIds.get(row.id) ?? []));
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { trip_id, title, image_url, note, date, spot_ids } = req.body;
    const result = db
      .prepare(
        `INSERT INTO ideas (trip_id, title, image_url, note, date, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, title, image_url ?? null, note ?? null, date ?? null, req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionSpots(ideaId, spot_ids ?? []);
    reply.code(201);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    return serializeIdea(row, spot_ids ?? []);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const { title, image_url, note, date, spot_ids } = req.body;
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, note = ?, date = ?
         WHERE id = ?`,
      )
      .run(title, image_url ?? null, note ?? null, date ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    syncExcursionSpots(Number(req.params.id), spot_ids ?? []);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id) as IdeaRow;
    return serializeIdea(row, spot_ids ?? []);
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
