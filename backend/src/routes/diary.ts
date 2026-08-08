import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/index.js';
import { uploadsDir } from '../uploads.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

interface EntryRow {
  id: number;
  trip_id: number;
  author_id: number;
  title: string | null;
  content: string;
  images: string | null;
  date: string;
  created_at: string;
  updated_at: string | null;
}

interface EntryBody {
  trip_id: number;
  title?: string;
  content: string;
  content_format?: 'html' | 'legacy';
  images?: string[];
  excursion_ids?: number[];
  date?: string;
}

// Zuordnung Tagebucheintrag -> Ausflüge (m:n, analog syncExcursionSpots in ideas.ts): wird bei
// jedem Anlegen/Bearbeiten komplett neu geschrieben statt gedifft – kleine Anzahl Zeilen pro Eintrag.
function syncDiaryExcursions(entryId: number, excursionIds: number[]) {
  db.prepare('DELETE FROM diary_excursions WHERE entry_id = ?').run(entryId);
  const insert = db.prepare('INSERT INTO diary_excursions (entry_id, idea_id) VALUES (?, ?)');
  for (const excursionId of excursionIds) {
    insert.run(entryId, excursionId);
  }
}

function excursionIdsFor(entryIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (!entryIds.length) return map;
  const placeholders = entryIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT entry_id, idea_id FROM diary_excursions WHERE entry_id IN (${placeholders})`)
    .all(...entryIds) as { entry_id: number; idea_id: number }[];
  for (const row of rows) {
    const list = map.get(row.entry_id) ?? [];
    list.push(row.idea_id);
    map.set(row.entry_id, list);
  }
  return map;
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

function serializeEntry(row: EntryRow, excursionIds: number[]) {
  return { ...row, images: row.images ? (JSON.parse(row.images) as string[]) : [], excursion_ids: excursionIds };
}

export const diaryRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/diary', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const rows = db
      .prepare(
        'SELECT * FROM diary_entries WHERE trip_id = ? AND deleted_at IS NULL ORDER BY date DESC, created_at DESC, id DESC',
      )
      .all(req.query.trip_id) as EntryRow[];
    const excursionIds = excursionIdsFor(rows.map((r) => r.id));
    return rows.map((row) => serializeEntry(row, excursionIds.get(row.id) ?? []));
  });

  // trip_id jetzt erforderlich (vorher lieferten beide Routen ungefiltert ALLE Likes/Kommentare
  // aller Urlaube zurück – seit Einführung des Mitgliedschaftskonzepts wäre das ein Datenleck über
  // Urlaubsgrenzen hinweg, siehe tripAccess.ts).
  app.get<{ Querystring: { trip_id?: string } }>('/diary/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT diary_likes.* FROM diary_likes
         JOIN diary_entries ON diary_entries.id = diary_likes.entry_id
         WHERE diary_entries.trip_id = ?`,
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/diary/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT diary_comments.* FROM diary_comments
         JOIN diary_entries ON diary_entries.id = diary_comments.entry_id
         WHERE diary_entries.trip_id = ?
         ORDER BY diary_comments.created_at ASC, diary_comments.id ASC`,
      )
      .all(req.query.trip_id);
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
    const { trip_id, title, content, images, excursion_ids, date } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const isHtml = req.body.content_format === 'html';
    const now = new Date().toISOString();
    const result = db
      .prepare(
        'INSERT INTO diary_entries (trip_id, author_id, title, content, content_format, images, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        trip_id,
        req.session.userId,
        title ?? null,
        isHtml ? sanitizeHtml(content) : content,
        isHtml ? 'html' : 'legacy',
        JSON.stringify(images ?? []),
        // Client schickt immer ein vorausgewähltes Datum (Default: heute, siehe DiaryView.vue) -
        // der Fallback hier greift nur defensiv, falls ein Client das Feld doch mal wegließe.
        date || now.slice(0, 10),
        now,
      );
    const entryId = result.lastInsertRowid as number;
    syncDiaryExcursions(entryId, excursion_ids ?? []);
    recordActivity(trip_id, 'diary', entryId, 'created', req.session.userId!);
    reply.code(201);
    const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(entryId) as EntryRow;
    return serializeEntry(row, excursion_ids ?? []);
  });

  app.put<{ Params: { id: string }; Body: EntryBody }>('/diary/:id', async (req, reply) => {
    const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as
      | EntryRow
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, entry.trip_id, req.session.userId)) return;
    if (entry.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Beitrag bearbeiten' });
    }

    const { title, content, images, excursion_ids, date } = req.body;
    const isHtml = req.body.content_format === 'html';
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE diary_entries SET title = ?, content = ?, content_format = ?, images = ?, date = ?, updated_at = ? WHERE id = ?',
    ).run(
      title ?? null,
      isHtml ? sanitizeHtml(content) : content,
      isHtml ? 'html' : 'legacy',
      JSON.stringify(images ?? []),
      date || entry.date,
      now,
      req.params.id,
    );
    syncDiaryExcursions(Number(req.params.id), excursion_ids ?? []);
    recordActivity(entry.trip_id, 'diary', Number(req.params.id), 'updated', req.session.userId!);
    const row = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as EntryRow;
    return serializeEntry(row, excursion_ids ?? []);
  });

  app.delete<{ Params: { id: string } }>('/diary/:id', async (req, reply) => {
    const entry = db.prepare('SELECT * FROM diary_entries WHERE id = ?').get(req.params.id) as
      | EntryRow
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, entry.trip_id, req.session.userId)) return;
    if (entry.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Beitrag löschen' });
    }
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    db.prepare('UPDATE diary_entries SET deleted_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
    recordActivity(entry.trip_id, 'diary', Number(req.params.id), 'deleted', req.session.userId!);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/diary/:id/like', async (req, reply) => {
    const entry = db.prepare('SELECT id, trip_id FROM diary_entries WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, entry.trip_id, req.session.userId)) return;

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
    const entry = db.prepare('SELECT id, trip_id FROM diary_entries WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!entry) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, entry.trip_id, req.session.userId)) return;

    const result = db
      .prepare('INSERT INTO diary_comments (entry_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM diary_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/diary/comments/:id', async (req, reply) => {
    const comment = db
      .prepare(
        `SELECT diary_comments.id, diary_comments.author_id, diary_entries.trip_id FROM diary_comments
         JOIN diary_entries ON diary_entries.id = diary_comments.entry_id
         WHERE diary_comments.id = ?`,
      )
      .get(req.params.id) as { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM diary_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
