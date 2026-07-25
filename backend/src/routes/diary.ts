import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';

interface EntryRow {
  id: number;
  trip_id: number;
  author_id: number;
  title: string | null;
  content: string;
  images: string | null;
  created_at: string;
  updated_at: string | null;
}

interface EntryBody {
  trip_id: number;
  title?: string;
  content: string;
  images?: string[];
}

interface CommentBody {
  content: string;
}

interface ImageUploadBody {
  data: string;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function serializeEntry(row: EntryRow) {
  return { ...row, images: row.images ? (JSON.parse(row.images) as string[]) : [] };
}

export const diaryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/diary', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    const rows = db
      .prepare('SELECT * FROM diary_entries WHERE trip_id = ? ORDER BY created_at DESC, id DESC')
      .all(req.query.trip_id) as EntryRow[];
    return rows.map(serializeEntry);
  });

  app.get('/diary/likes', async () => {
    return db.prepare('SELECT * FROM diary_likes').all();
  });

  app.get('/diary/comments', async () => {
    return db.prepare('SELECT * FROM diary_comments ORDER BY created_at ASC, id ASC').all();
  });

  // Nimmt ein bereits client-seitig (Canvas-API) verkleinertes/komprimiertes Bild als Data-URL
  // entgegen und legt es als Datei ab – bewusst kein serverseitiges Resizing (z. B. via sharp),
  // das ist auf dem ressourcenschwachen Raspberry Pi 2 zu teuer.
  app.post<{ Body: ImageUploadBody }>('/diary/images', async (req, reply) => {
    const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(req.body?.data ?? '');
    if (!match) return reply.code(400).send({ error: 'Ungültiges Bildformat' });

    const [, mimeType, base64] = match;
    const extension = ALLOWED_IMAGE_TYPES[mimeType];
    if (!extension) return reply.code(400).send({ error: 'Nicht unterstützter Bildtyp' });

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return reply.code(413).send({ error: 'Bild ist zu groß (max. 5 MB nach Komprimierung)' });
    }

    const filename = `${randomUUID()}.${extension}`;
    await writeFile(path.join(uploadsDir, filename), buffer);
    reply.code(201);
    return { url: `/api/uploads/${filename}` };
  });

  app.post<{ Body: EntryBody }>('/diary', async (req, reply) => {
    const { trip_id, title, content, images } = req.body;
    const now = new Date().toISOString();
    const result = db
      .prepare(
        'INSERT INTO diary_entries (trip_id, author_id, title, content, images, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(trip_id, req.session.userId, title ?? null, content, JSON.stringify(images ?? []), now);
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
