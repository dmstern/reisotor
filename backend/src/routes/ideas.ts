import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  note?: string;
  note_format?: 'html' | 'legacy';
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

interface PlanSpotBody {
  trip_id: number;
  spot_id: number;
  date: string;
}

// Welche Spots zu welcher Tour gehören, in welcher Reihenfolge (Batch 13, Reihenfolge/Mehrfach-
// besuche nachgerüstet; Batch 14: generischer station_key statt spot_id, für Unterkunft-/Reise-
// Etappen-Enden ohne eigenen Spot). station_key wich zwischenzeitlich einer echten spot_id-Fremd-
// schlüsselspalte (siehe Migrationskommentar in db/index.ts) – Reihenfolge (position) und
// Mehrfachbesuch (derselbe Spot z. B. als Start UND Ende eines Rundgangs) bleiben aber bewusst
// erhalten, da zwei UI-Modi (einfaches Tagging vs. "Erweiterte Touren-Bearbeitung", siehe
// ProfileView.vue) sich dasselbe Datenmodell teilen. spot_ids ist daher weiterhin ein geordnetes
// Array (Duplikate erlaubt), nicht nur eine Menge. Wird bei jedem Anlegen/Bearbeiten komplett neu
// geschrieben (einfacher als Diffing) – kleine Anzahl Zeilen pro Tour.
function syncExcursionSpots(ideaId: number, spotIds: number[]) {
  db.prepare('DELETE FROM excursion_spots WHERE idea_id = ?').run(ideaId);
  const insert = db.prepare('INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)');
  spotIds.forEach((spotId, index) => insert.run(ideaId, spotId, index));
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

// Ein Ausflug ist "geplant", wenn genau ein Kalender-Termin (schedule_items) über idea_id auf ihn
// verweist – kein eigenes Datums-Feld mehr auf dem Ausflug selbst (siehe Kommentar in db/index.ts).
// Bündelt dieselbe Batch-Abfrage-Optik wie spotIdsFor oben.
function scheduleDatesForIdeas(ideaIds: number[]): Map<number, string> {
  const map = new Map<number, string>();
  if (!ideaIds.length) return map;
  const placeholders = ideaIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT idea_id, date FROM schedule_items WHERE idea_id IN (${placeholders}) AND deleted_at IS NULL`,
    )
    .all(...ideaIds) as { idea_id: number; date: string }[];
  for (const row of rows) map.set(row.idea_id, row.date);
  return map;
}

// Legt den Kalender-Termin an/aktualisiert/löscht ihn, der einen Ausflug im Kalender repräsentiert
// – ersetzt die frühere eigene Datums-Spalte auf "ideas". Sowohl das Datum-Feld im Ausflug-
// Formular (ExcursionsView.vue) als auch das Ziehen auf einen Kalendertag (excursionsStore.
// setDate) laufen über denselben PUT/POST /ideas-Endpunkt und landen daher hier – EIN Mechanismus
// statt zweier, wie es vor der Einführung des separaten "Ein-Spot-Ausflug"-Hacks für Spots war.
function setIdeaScheduleDate(ideaId: number, tripId: number, title: string, date: string | null | undefined) {
  const existing = db
    .prepare('SELECT id FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL')
    .get(ideaId) as { id: number } | undefined;
  if (date) {
    if (existing) {
      db.prepare('UPDATE schedule_items SET date = ? WHERE id = ?').run(date, existing.id);
    } else {
      db.prepare('INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)').run(
        tripId,
        date,
        title,
        ideaId,
      );
    }
  } else if (existing) {
    db.prepare('DELETE FROM schedule_items WHERE id = ?').run(existing.id);
  }
}

function serializeIdea(row: IdeaRow, spotIds: number[], date: string | null) {
  return { ...row, spot_ids: spotIds, date };
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const rows = db
      .prepare('SELECT * FROM ideas WHERE trip_id = ? AND deleted_at IS NULL ORDER BY id DESC')
      .all(req.query.trip_id) as IdeaRow[];
    const spotIds = spotIdsFor(rows.map((r) => r.id));
    const dates = scheduleDatesForIdeas(rows.map((r) => r.id));
    return rows.map((row) => serializeIdea(row, spotIds.get(row.id) ?? [], dates.get(row.id) ?? null));
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const { trip_id, title, image_url, note, date, spot_ids } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const isHtml = req.body.note_format === 'html';
    const result = db
      .prepare(
        `INSERT INTO ideas (trip_id, title, image_url, note, note_format, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, title, image_url ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionSpots(ideaId, spot_ids ?? []);
    setIdeaScheduleDate(ideaId, trip_id, title, date);
    recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId!);
    reply.code(201);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    return serializeIdea(row, spot_ids ?? [], date ?? null);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const existingIdea = db.prepare('SELECT trip_id FROM ideas WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingIdea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId)) return;

    const { title, image_url, note, date, spot_ids } = req.body;
    const isHtml = req.body.note_format === 'html';
    const result = db
      .prepare(
        `UPDATE ideas SET title = ?, image_url = ?, note = ?, note_format = ?
         WHERE id = ?`,
      )
      .run(title, image_url ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    const ideaId = Number(req.params.id);
    syncExcursionSpots(ideaId, spot_ids ?? []);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    setIdeaScheduleDate(ideaId, row.trip_id as number, title, date);
    recordActivity(existingIdea.trip_id, 'ideas', ideaId, 'updated', req.session.userId!);
    return serializeIdea(row, spot_ids ?? [], date ?? null);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeilen
  // wirklich zu entfernen. Der verknüpfte Kalender-Termin (schedule_items.idea_id) wird dabei
  // mit "weggelöscht" – sonst bliebe er als Karteileiche mit einem im Papierkorb liegenden Ausflug
  // im Kalender sichtbar. routes/trash.ts's restore() macht diese Kopplung beim Wiederherstellen
  // wieder rückgängig (siehe dort).
  app.delete<{ Params: { id: string } }>('/ideas/:id', async (req, reply) => {
    const existingIdea = db.prepare('SELECT trip_id FROM ideas WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingIdea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId)) return;

    const deleteWithSchedule = db.transaction((id: string) => {
      const now = new Date().toISOString();
      db.prepare('UPDATE schedule_items SET deleted_at = ? WHERE idea_id = ? AND deleted_at IS NULL').run(now, id);
      return db.prepare('UPDATE ideas SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, id);
    });
    const result = deleteWithSchedule(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(existingIdea.trip_id, 'ideas', Number(req.params.id), 'deleted', req.session.userId!);
    return reply.code(204).send();
  });

  // "Gemacht"-Status: unabhängiges Flag neben geplant/ungeplant (das weiterhin rein aus einem
  // verknüpften schedule_items-Termin abgeleitet wird, siehe scheduleDatesForIdeas oben) - auch
  // spontane, nie geplante Touren sollen markierbar sein. Eigener Endpunkt statt Teil von
  // PUT /ideas/:id, damit ein Toggle nicht das gesamte Formular erneut mitschicken muss - analog
  // zum bestehenden /like-Toggle.
  app.post<{ Params: { id: string }; Body: { done: boolean } }>('/ideas/:id/done', async (req, reply) => {
    const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

    const done = req.body.done ? 1 : 0;
    db.prepare('UPDATE ideas SET done = ? WHERE id = ?').run(done, req.params.id);
    recordActivity(idea.trip_id, 'ideas', idea.id, 'updated', req.session.userId!);
    return { done: done === 1 };
  });

  // Spontanes Einplanen eines einzelnen Spots im Tagebuch (siehe DiaryView.vue's Spot-Picker), OHNE
  // dass die Nutzerin vorher einen Ausflug anlegen muss: legt im Hintergrund einen "Ausflug" mit
  // genau dieser einen Station an – für die Nutzerin unsichtbar, sie sieht nur "der Spot ist an
  // diesem Tag geplant". NICHT mehr der Weg, auf dem ein Spot im KALENDER eingeplant wird (das
  // erzeugt jetzt einen direkt mit dem Spot verknüpften Termin, siehe routes/schedule.ts) – bleibt
  // nur für den Tagebuch-Anwendungsfall bestehen, der einen Ausflug zum Verknüpfen braucht
  // (diary_excursions referenziert ausschließlich idea_id). Dedupe-Check (exakt EINE Station mit
  // demselben Spot an trip_id+Termin-Datum) verhindert Duplikate, wenn derselbe Spot mehrfach für
  // denselben Tag ausgelöst wird – zwei VERSCHIEDENE Spots am selben Tag erzeugen dagegen bewusst
  // je einen eigenen Ausflug (kein Zusammenlegen).
  app.post<{ Body: PlanSpotBody }>('/ideas/plan-spot', async (req, reply) => {
    const { trip_id, spot_id, date } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;

    const candidates = db
      .prepare(
        `SELECT ideas.id AS id FROM ideas
         JOIN schedule_items ON schedule_items.idea_id = ideas.id
         WHERE ideas.trip_id = ? AND ideas.deleted_at IS NULL AND schedule_items.deleted_at IS NULL
           AND schedule_items.date = ?`,
      )
      .all(trip_id, date) as { id: number }[];

    let existing: { id: number } | undefined;
    if (candidates.length) {
      const placeholders = candidates.map(() => '?').join(',');
      existing = db
        .prepare(
          `SELECT idea_id AS id FROM excursion_spots
           WHERE idea_id IN (${placeholders})
           GROUP BY idea_id
           HAVING COUNT(*) = 1 AND MAX(spot_id) = ?`,
        )
        .get(...candidates.map((c) => c.id), spot_id) as { id: number } | undefined;
    }

    if (existing) {
      const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(existing.id) as IdeaRow;
      return serializeIdea(row, [spot_id], date);
    }

    const spot = db.prepare('SELECT title FROM spots WHERE id = ? AND deleted_at IS NULL').get(spot_id) as
      | { title: string }
      | undefined;
    if (!spot) return reply.code(404).send({ error: 'Spot nicht gefunden' });

    const result = db
      .prepare('INSERT INTO ideas (trip_id, title, created_by) VALUES (?, ?, ?)')
      .run(trip_id, spot.title, req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionSpots(ideaId, [spot_id]);
    setIdeaScheduleDate(ideaId, trip_id, spot.title, date);
    recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId!);
    reply.code(201);
    const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId) as IdeaRow;
    return serializeIdea(row, [spot_id], date);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/ideas/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
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
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
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
    const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

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
    const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

    const result = db
      .prepare('INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM idea_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/ideas/comments/:id', async (req, reply) => {
    const comment = db
      .prepare(
        `SELECT idea_comments.id, idea_comments.author_id, ideas.trip_id FROM idea_comments
         JOIN ideas ON ideas.id = idea_comments.idea_id
         WHERE idea_comments.id = ?`,
      )
      .get(req.params.id) as { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM idea_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
