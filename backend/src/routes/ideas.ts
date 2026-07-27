import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  note?: string;
  date?: string;
  station_keys?: string[];
}

interface IdeaRow {
  id: number;
  [key: string]: unknown;
}

interface CommentBody {
  content: string;
}

interface PlanSpotBody {
  trip_id: number;
  spot_id: number;
  date: string;
}

// Stationen eines Ausflugs (Batch 13, Reihenfolge/Mehrfachbesuche nachgerüstet; Batch 14:
// generischer station_key statt spot_id): welche Orte gehören dazu, in welcher Reihenfolge. Eine
// Station muss kein echter Spot sein – station_key trägt auch 'accommodation-<id>'/
// 'travel-from-<id>'/'travel-to-<id>' (siehe db/index.ts), damit Unterkunft/Anreise-/Abreise-Ort
// eingeplant werden können, ohne dafür einen Spot anzulegen. Wird bei jedem Anlegen/Bearbeiten
// komplett neu geschrieben (einfacher als Diffing) – kleine Anzahl Zeilen pro Ausflug. `position`
// statt der Zeilen-Id bestimmt die Reihenfolge, damit derselbe Ort mehrfach vorkommen darf (z. B.
// Start UND Ende an der Unterkunft für einen Rundgang).
function syncExcursionStations(ideaId: number, stationKeys: string[]) {
  db.prepare('DELETE FROM excursion_spots WHERE idea_id = ?').run(ideaId);
  const insert = db.prepare('INSERT INTO excursion_spots (idea_id, station_key, position) VALUES (?, ?, ?)');
  stationKeys.forEach((key, index) => {
    insert.run(ideaId, key, index);
  });
}

function stationKeysFor(ideaIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  if (!ideaIds.length) return map;
  const placeholders = ideaIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT idea_id, station_key FROM excursion_spots WHERE idea_id IN (${placeholders}) ORDER BY idea_id, position`,
    )
    .all(...ideaIds) as { idea_id: number; station_key: string }[];
  for (const row of rows) {
    const list = map.get(row.idea_id) ?? [];
    list.push(row.station_key);
    map.set(row.idea_id, list);
  }
  return map;
}

function serializeIdea(row: IdeaRow, stationKeys: string[]) {
  return { ...row, station_keys: stationKeys };
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    const rows = db.prepare('SELECT * FROM ideas WHERE trip_id = ? ORDER BY id DESC').all(req.query.trip_id) as IdeaRow[];
    const stationKeys = stationKeysFor(rows.map((r) => r.id));
    return rows.map((row) => serializeIdea(row, stationKeys.get(row.id) ?? []));
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { trip_id, title, image_url, note, date, station_keys } = req.body;
    const result = db
      .prepare(
        `INSERT INTO ideas (trip_id, title, image_url, note, date, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, title, image_url ?? null, note ?? null, date ?? null, req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionStations(ideaId, station_keys ?? []);
    reply.code(201);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    return serializeIdea(row, station_keys ?? []);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const { title, image_url, note, date, station_keys } = req.body;
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, note = ?, date = ?
         WHERE id = ?`,
      )
      .run(title, image_url ?? null, note ?? null, date ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    syncExcursionStations(Number(req.params.id), station_keys ?? []);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(req.params.id) as IdeaRow;
    return serializeIdea(row, station_keys ?? []);
  });

  app.delete<{ Params: { id: string } }>('/ideas/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM ideas WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // Spontanes Einplanen eines einzelnen Spots (ohne dass die Nutzerin vorher einen Ausflug
  // anlegen muss, siehe MapView.vue/SpotCard.vue Kalender-Anfasser und DiaryView.vue
  // Spot-Picker): legt im Hintergrund einen "Ausflug" mit genau dieser einen Station an – für
  // die Nutzerin unsichtbar, sie sieht nur "der Spot ist an diesem Tag geplant". Dedupe-Check
  // (exakt EIN Stations-Eintrag mit demselben station_key an trip_id+date) verhindert
  // Duplikate, wenn derselbe Spot mehrfach für denselben Tag ausgelöst wird (z. B. Kalender-Drop
  // gefolgt von Tagebuch-Auswahl) – zwei VERSCHIEDENE Spots am selben Tag erzeugen dagegen
  // bewusst je einen eigenen Ausflug (kein Zusammenlegen).
  app.post<{ Body: PlanSpotBody }>('/ideas/plan-spot', async (req, reply) => {
    const { trip_id, spot_id, date } = req.body;
    const stationKey = `spot-${spot_id}`;

    const existing = db
      .prepare(
        `SELECT ideas.id AS id FROM ideas
         JOIN excursion_spots ON excursion_spots.idea_id = ideas.id
         WHERE ideas.trip_id = ? AND ideas.date = ?
         GROUP BY ideas.id
         HAVING COUNT(*) = 1 AND MAX(excursion_spots.station_key) = ?`,
      )
      .get(trip_id, date, stationKey) as { id: number } | undefined;

    if (existing) {
      const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(existing.id) as IdeaRow;
      return serializeIdea(row, [stationKey]);
    }

    const spot = db.prepare('SELECT title FROM spots WHERE id = ?').get(spot_id) as { title: string } | undefined;
    if (!spot) return reply.code(404).send({ error: 'Spot nicht gefunden' });

    const result = db
      .prepare('INSERT INTO ideas (trip_id, title, date, created_by) VALUES (?, ?, ?, ?)')
      .run(trip_id, spot.title, date, req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionStations(ideaId, [stationKey]);
    reply.code(201);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    return serializeIdea(row, [stationKey]);
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
