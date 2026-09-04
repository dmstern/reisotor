import type { FastifyPluginAsync } from 'fastify';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

// role/transport_type/... (#176): eine Tour mit gesetzter role ist die ehemalige Reise-Etappe
// (Anreise/Abreise/Weiterreise) - dieselbe ideas-Zeile trägt jetzt sowohl die normale Tour- als auch
// die Transportmittel-Zusatzfelder, siehe Konzept-Kommentar in Issue #68.
type IdeaRole = 'arrival' | 'departure' | 'onward';

interface IdeaBody {
  trip_id: number;
  title: string;
  image_url?: string;
  note?: string;
  note_format?: 'html' | 'legacy';
  date?: string;
  spot_ids?: number[];
  role?: IdeaRole | null;
  transport_type?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  checkin_info?: string | null;
  amount?: number | null;
  paid_by_user_id?: number | null;
  luggage?: string | null;
  seat?: string | null;
  ticket_link?: string | null;
}

interface IdeaRow {
  id: number;
  budget_expense_id: number | null;
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
const deleteExcursionSpotsStmt = db.prepare('DELETE FROM excursion_spots WHERE idea_id = ?');
const insertExcursionSpotStmt = db.prepare(
  'INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)'
);
const selectScheduleByIdeaStmt = db.prepare(
  'SELECT id FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL'
);
const updateScheduleDateTitleStmt = db.prepare(
  'UPDATE schedule_items SET date = ?, title = ? WHERE id = ?'
);
const insertScheduleIdeaStmt = db.prepare(
  'INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)'
);
const deleteScheduleItemStmt = db.prepare('DELETE FROM schedule_items WHERE id = ?');
const updateBudgetItemForIdeaStmt = db.prepare(
  'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, budget_id = ? WHERE id = ?'
);
const insertBudgetItemForIdeaStmt = db.prepare(
  `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const selectIdeasByTripStmt = db.prepare(
  'SELECT * FROM ideas WHERE trip_id = ? AND deleted_at IS NULL ORDER BY id DESC'
);
const insertIdeaStmt = db.prepare(
  `INSERT INTO ideas (
    trip_id, title, image_url, note, note_format, created_by,
    role, transport_type, departure_time, arrival_time, checkin_info,
    amount, paid_by_user_id, luggage, seat, ticket_link, budget_expense_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectIdeaByIdStmt = db.prepare('SELECT * FROM ideas WHERE id = ?');
const selectIdeaAuthStmt = db.prepare('SELECT trip_id, budget_expense_id FROM ideas WHERE id = ?');
const updateIdeaStmt = db.prepare(
  `UPDATE ideas SET title = ?, image_url = ?, note = ?, note_format = ?,
    role = ?, transport_type = ?, departure_time = ?, arrival_time = ?, checkin_info = ?,
    amount = ?, paid_by_user_id = ?, luggage = ?, seat = ?, ticket_link = ?, budget_expense_id = ?
   WHERE id = ?`
);
const deleteBudgetItemStmt = db.prepare('DELETE FROM budget_items WHERE id = ?');
const selectScheduleItemsByIdeaStmt = db.prepare(
  'SELECT id FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL'
);
const softDeleteScheduleByIdeaStmt = db.prepare(
  'UPDATE schedule_items SET deleted_at = ? WHERE idea_id = ? AND deleted_at IS NULL'
);
const softDeleteBudgetItemStmt = db.prepare(
  'UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
);
const softDeleteIdeaStmt = db.prepare(
  'UPDATE ideas SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
);
const selectIdeaTripIdStmt = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?');
const selectScheduleForDoneStmt = db.prepare(
  'SELECT 1 FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL LIMIT 1'
);
const updateIdeaDoneStmt = db.prepare('UPDATE ideas SET done = ? WHERE id = ?');
const selectSpotTitleByIdStmt = db.prepare(
  'SELECT title FROM spots WHERE id = ? AND deleted_at IS NULL'
);
const insertIdeaForSpotStmt = db.prepare(
  'INSERT INTO ideas (trip_id, title, created_by) VALUES (?, ?, ?)'
);
const selectIdeaLikesByTripStmt = db.prepare(
  `SELECT idea_likes.* FROM idea_likes
   JOIN ideas ON ideas.id = idea_likes.idea_id
   WHERE ideas.trip_id = ?`
);
const selectIdeaCommentsByTripStmt = db.prepare(
  `SELECT idea_comments.* FROM idea_comments
   JOIN ideas ON ideas.id = idea_comments.idea_id
   WHERE ideas.trip_id = ?
   ORDER BY idea_comments.created_at ASC, idea_comments.id ASC`
);
const selectIdeaLikeStmt = db.prepare(
  'SELECT id FROM idea_likes WHERE idea_id = ? AND user_id = ?'
);
const deleteIdeaLikeStmt = db.prepare('DELETE FROM idea_likes WHERE id = ?');
const insertIdeaLikeStmt = db.prepare(
  'INSERT INTO idea_likes (idea_id, user_id, created_at) VALUES (?, ?, ?)'
);
const insertIdeaCommentStmt = db.prepare(
  'INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
);
const selectIdeaCommentByIdStmt = db.prepare('SELECT * FROM idea_comments WHERE id = ?');
const selectIdeaCommentAuthStmt = db.prepare(
  `SELECT idea_comments.id, idea_comments.author_id, ideas.trip_id FROM idea_comments
   JOIN ideas ON ideas.id = idea_comments.idea_id
   WHERE idea_comments.id = ?`
);
const deleteIdeaCommentStmt = db.prepare('DELETE FROM idea_comments WHERE id = ?');

function syncExcursionSpots(ideaId: number, spotIds: number[]) {
  deleteExcursionSpotsStmt.run(ideaId);
  spotIds.forEach((spotId, index) => insertExcursionSpotStmt.run(ideaId, spotId, index));
}

function spotIdsFor(ideaIds: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  if (!ideaIds.length) return map;
  const placeholders = ideaIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT idea_id, spot_id FROM excursion_spots WHERE idea_id IN (${placeholders}) ORDER BY idea_id, position`
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
      `SELECT idea_id, date FROM schedule_items WHERE idea_id IN (${placeholders}) AND deleted_at IS NULL`
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
function setIdeaScheduleDate(
  ideaId: number,
  tripId: number,
  title: string,
  date: string | null | undefined,
  userId?: number
) {
  const existing = selectScheduleByIdeaStmt.get(ideaId) as { id: number } | undefined;
  if (date) {
    if (existing) {
      updateScheduleDateTitleStmt.run(date, title, existing.id);
      if (userId) recordActivity(tripId, 'schedule', existing.id, 'updated', userId);
    } else {
      const result = insertScheduleIdeaStmt.run(tripId, date, title, ideaId);
      if (userId)
        recordActivity(tripId, 'schedule', result.lastInsertRowid as number, 'created', userId);
    }
  } else if (existing) {
    deleteScheduleItemStmt.run(existing.id);
    if (userId) recordActivity(tripId, 'schedule', existing.id, 'deleted', userId);
  }
}

function serializeIdea(row: IdeaRow, spotIds: number[], date: string | null) {
  return { ...row, spot_ids: spotIds, date };
}

/** Budget-Sync für Touren mit gesetztem role (ehemalige Reise-Etappen) - Gegenstück zu
 *  routes/travel.ts's planBudgetExpense() vor #176, gleiches Muster wie dort: legt die verknüpfte
 *  Ausgabe an/aktualisiert sie, löscht aber noch NICHT die alte Ausgabe (staleIdToDelete), damit der
 *  Aufrufer sie erst löscht, NACHDEM die ideas-Zeile nicht mehr per Foreign Key darauf verweist
 *  (sonst SQLITE_CONSTRAINT_FOREIGNKEY). Nur Touren mit amount+paid_by_user_id bekommen überhaupt
 *  eine Ausgabe - eine normale Tour ohne diese Felder bleibt unangetastet (budgetExpenseId bleibt
 *  null, kein Aufruf nötig, Aufrufer prüft das selbst). */
function planIdeaBudgetExpense(
  tripId: number,
  existingBudgetExpenseId: number | null,
  title: string,
  date: string | null | undefined,
  amount: number | null | undefined,
  paidByUserId: number | null | undefined
) {
  const hasAmount = amount != null && amount > 0 && paidByUserId != null;

  if (!hasAmount) {
    return { budgetExpenseId: null as number | null, staleIdToDelete: existingBudgetExpenseId };
  }

  const sharedBudgetId = ensureDefaultSharedBudget(tripId);

  if (existingBudgetExpenseId) {
    updateBudgetItemForIdeaStmt.run(
      title,
      'Transport',
      amount,
      paidByUserId,
      date ?? null,
      sharedBudgetId,
      existingBudgetExpenseId
    );
    return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
  }

  const result = insertBudgetItemForIdeaStmt.run(
    tripId,
    title,
    'Transport',
    amount,
    paidByUserId,
    date ?? null,
    'Automatisch aus Tour',
    sharedBudgetId
  );
  return { budgetExpenseId: result.lastInsertRowid as number, staleIdToDelete: null };
}

export const ideasRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/ideas', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const rows = selectIdeasByTripStmt.all(req.query.trip_id) as IdeaRow[];
    const spotIds = spotIdsFor(rows.map((r) => r.id));
    const dates = scheduleDatesForIdeas(rows.map((r) => r.id));
    return rows.map((row) =>
      serializeIdea(row, spotIds.get(row.id) ?? [], dates.get(row.id) ?? null)
    );
  });

  app.post<{ Body: IdeaBody }>('/ideas', async (req, reply) => {
    const {
      trip_id,
      title,
      image_url,
      note,
      date,
      spot_ids,
      role,
      transport_type,
      departure_time,
      arrival_time,
      checkin_info,
      amount,
      paid_by_user_id,
      luggage,
      seat,
      ticket_link,
    } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    // Rolle (Anreise/Abreise/Weiterreise) nur mit genau zwei Stationen (Von/Nach) - siehe
    // Konzept-Entscheidung in Issue #68/#176. Eine normale Tour (role nicht gesetzt) bleibt frei in
    // der Stationsanzahl.
    if (role && (spot_ids?.length ?? 0) !== 2) {
      return reply.code(400).send({
        error:
          'Eine Tour mit Rolle (Anreise/Abreise/Weiterreise) braucht genau zwei Stationen (Von/Nach).',
      });
    }
    const isHtml = req.body.note_format === 'html';
    const { budgetExpenseId } = planIdeaBudgetExpense(
      trip_id,
      null,
      title,
      date,
      amount,
      paid_by_user_id
    );
    const result = insertIdeaStmt.run(
      trip_id,
      title,
      image_url ?? null,
      note ? (isHtml ? sanitizeHtml(note) : note) : null,
      isHtml ? 'html' : 'legacy',
      req.session.userId,
      role ?? null,
      transport_type ?? null,
      departure_time ?? null,
      arrival_time ?? null,
      checkin_info ?? null,
      amount ?? null,
      paid_by_user_id ?? null,
      luggage ?? null,
      seat ?? null,
      ticket_link ?? null,
      budgetExpenseId
    );
    const ideaId = result.lastInsertRowid as number;
    syncExcursionSpots(ideaId, spot_ids ?? []);
    setIdeaScheduleDate(ideaId, trip_id, title, date, req.session.userId);
    recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId!);
    reply.code(201);
    const row = selectIdeaByIdStmt.get(ideaId) as IdeaRow;
    return serializeIdea(row, spot_ids ?? [], date ?? null);
  });

  app.put<{ Params: { id: string }; Body: IdeaBody }>('/ideas/:id', async (req, reply) => {
    const existingIdea = selectIdeaAuthStmt.get(req.params.id) as
      { trip_id: number; budget_expense_id: number | null } | undefined;
    if (!existingIdea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId)) return;

    const {
      title,
      image_url,
      note,
      date,
      spot_ids,
      role,
      transport_type,
      departure_time,
      arrival_time,
      checkin_info,
      amount,
      paid_by_user_id,
      luggage,
      seat,
      ticket_link,
    } = req.body;
    if (role && (spot_ids?.length ?? 0) !== 2) {
      return reply.code(400).send({
        error:
          'Eine Tour mit Rolle (Anreise/Abreise/Weiterreise) braucht genau zwei Stationen (Von/Nach).',
      });
    }
    const isHtml = req.body.note_format === 'html';
    const { budgetExpenseId, staleIdToDelete } = planIdeaBudgetExpense(
      existingIdea.trip_id,
      existingIdea.budget_expense_id,
      title,
      date,
      amount,
      paid_by_user_id
    );
    const result = updateIdeaStmt.run(
      title,
      image_url ?? null,
      note ? (isHtml ? sanitizeHtml(note) : note) : null,
      isHtml ? 'html' : 'legacy',
      role ?? null,
      transport_type ?? null,
      departure_time ?? null,
      arrival_time ?? null,
      checkin_info ?? null,
      amount ?? null,
      paid_by_user_id ?? null,
      luggage ?? null,
      seat ?? null,
      ticket_link ?? null,
      budgetExpenseId,
      req.params.id
    );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    // Erst jetzt löschen: die ideas-Zeile verweist nicht mehr auf die alte Ausgabe (gleiches Muster
    // wie zuvor in routes/travel.ts).
    if (staleIdToDelete) {
      deleteBudgetItemStmt.run(staleIdToDelete);
    }
    const ideaId = Number(req.params.id);
    syncExcursionSpots(ideaId, spot_ids ?? []);
    const row = selectIdeaByIdStmt.get(ideaId) as IdeaRow;
    setIdeaScheduleDate(ideaId, row.trip_id as number, title, date, req.session.userId);
    recordActivity(existingIdea.trip_id, 'ideas', ideaId, 'updated', req.session.userId!);
    return serializeIdea(row, spot_ids ?? [], date ?? null);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeilen
  // wirklich zu entfernen. Der verknüpfte Kalender-Termin (schedule_items.idea_id) UND (seit #176)
  // eine verknüpfte Budget-Ausgabe (ehemalige Reise-Etappe) werden dabei mit "weggelöscht" – sonst
  // blieben sie als Karteileichen sichtbar, während der Ausflug selbst im Papierkorb liegt.
  // routes/trash.ts's restore() macht beide Kopplungen beim Wiederherstellen wieder rückgängig.
  app.delete<{ Params: { id: string } }>('/ideas/:id', async (req, reply) => {
    const existingIdea = selectIdeaAuthStmt.get(req.params.id) as
      { trip_id: number; budget_expense_id: number | null } | undefined;
    if (!existingIdea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId)) return;

    let linkedScheduleItems: { id: number }[] = [];
    const deleteWithSchedule = db.transaction((id: string) => {
      const now = new Date().toISOString();
      linkedScheduleItems = selectScheduleItemsByIdeaStmt.all(id) as { id: number }[];
      softDeleteScheduleByIdeaStmt.run(now, id);
      if (existingIdea.budget_expense_id) {
        softDeleteBudgetItemStmt.run(now, existingIdea.budget_expense_id);
      }
      return softDeleteIdeaStmt.run(now, id);
    });
    const result = deleteWithSchedule(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    for (const item of linkedScheduleItems) {
      recordActivity(existingIdea.trip_id, 'schedule', item.id, 'deleted', req.session.userId!);
    }
    recordActivity(
      existingIdea.trip_id,
      'ideas',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });

  // "Gemacht"-Status (#106): setzbar nur, wenn die Tour bereits über einen verknüpften
  // schedule_items-Termin ein Datum trägt - eindeutige Statuskette in Planung -> geplant -> gemacht
  // statt (wie zuvor) unabhängiger Flags. Das Datum selbst wird NICHT hier gesetzt (bleibt Aufgabe
  // von PUT /ideas/:id bzw. excursionsStore.setDate), das Frontend führt vor einem Aufruf mit
  // done=true immer erst durch den Kalender-Bestätigungs-Flow (ExcursionCard.vue/ScheduleView.vue).
  // Eigener Endpunkt statt Teil von PUT /ideas/:id, damit ein Toggle nicht das gesamte Formular
  // erneut mitschicken muss - analog zum bestehenden /like-Toggle.
  app.post<{ Params: { id: string }; Body: { done: boolean } }>(
    '/ideas/:id/done',
    async (req, reply) => {
      const idea = selectIdeaTripIdStmt.get(req.params.id) as
        { id: number; trip_id: number } | undefined;
      if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

      const done = req.body.done ? 1 : 0;
      if (done) {
        const hasDate = selectScheduleForDoneStmt.get(req.params.id);
        if (!hasDate) {
          return reply
            .code(400)
            .send({ error: 'Für den Status "gemacht" muss zuerst ein Datum gesetzt werden.' });
        }
      }
      updateIdeaDoneStmt.run(done, req.params.id);
      recordActivity(idea.trip_id, 'ideas', idea.id, 'updated', req.session.userId!);
      return { done: done === 1 };
    }
  );

  // Spontanes Einplanen eines einzelnen Spots als Ein-Spot-Ausflug, OHNE dass vorher ein Ausflug
  // angelegt werden muss. NICHT der Weg, auf dem ein Spot im KALENDER eingeplant wird (das erzeugt
  // einen direkt mit dem Spot verknüpften Termin, siehe routes/schedule.ts) – DiaryView.vue's
  // Spot-Picker nutzte diesen Endpunkt bis #216 dafür, verknüpft Spots inzwischen direkt (siehe
  // diary_spots), der Endpunkt bleibt aber als generischer Weg bestehen, einen Spot spontan als
  // eigenen (Ein-Stations-)Ausflug einzuplanen. Dedupe-Check (exakt EINE Station mit demselben Spot
  // an trip_id+Termin-Datum) verhindert Duplikate, wenn derselbe Spot mehrfach für denselben Tag
  // ausgelöst wird – zwei VERSCHIEDENE Spots am selben Tag erzeugen dagegen bewusst je einen
  // eigenen Ausflug (kein Zusammenlegen).
  app.post<{ Body: PlanSpotBody }>('/ideas/plan-spot', async (req, reply) => {
    const { trip_id, spot_id, date } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;

    const candidates = db
      .prepare(
        `SELECT ideas.id AS id FROM ideas
         JOIN schedule_items ON schedule_items.idea_id = ideas.id
         WHERE ideas.trip_id = ? AND ideas.deleted_at IS NULL AND schedule_items.deleted_at IS NULL
           AND schedule_items.date = ?`
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
           HAVING COUNT(*) = 1 AND MAX(spot_id) = ?`
        )
        .get(...candidates.map((c) => c.id), spot_id) as { id: number } | undefined;
    }

    if (existing) {
      const row = selectIdeaByIdStmt.get(existing.id) as IdeaRow;
      return serializeIdea(row, [spot_id], date);
    }

    const spot = selectSpotTitleByIdStmt.get(spot_id) as { title: string } | undefined;
    if (!spot) return reply.code(404).send({ error: 'Spot nicht gefunden' });

    const result = insertIdeaForSpotStmt.run(trip_id, spot.title, req.session.userId);
    const ideaId = result.lastInsertRowid as number;
    syncExcursionSpots(ideaId, [spot_id]);
    setIdeaScheduleDate(ideaId, trip_id, spot.title, date, req.session.userId);
    recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId!);
    reply.code(201);
    const row = selectIdeaByIdStmt.get(ideaId) as IdeaRow;
    return serializeIdea(row, [spot_id], date);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/ideas/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return selectIdeaLikesByTripStmt.all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/ideas/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return selectIdeaCommentsByTripStmt.all(req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/ideas/:id/like', async (req, reply) => {
    const idea = selectIdeaTripIdStmt.get(req.params.id) as
      { id: number; trip_id: number } | undefined;
    if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

    const existing = selectIdeaLikeStmt.get(req.params.id, req.session.userId) as
      { id: number } | undefined;

    if (existing) {
      deleteIdeaLikeStmt.run(existing.id);
      return { liked: false };
    }

    insertIdeaLikeStmt.run(req.params.id, req.session.userId, new Date().toISOString());
    // Nur beim Liken selbst, nicht beim Zurücknehmen (#97, Notification-Inbox) - ein Un-Like ist kein
    // neues, benachrichtigungswürdiges Ereignis.
    recordActivity(idea.trip_id, 'ideas', idea.id, 'liked', req.session.userId!);
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>(
    '/ideas/:id/comments',
    async (req, reply) => {
      const idea = selectIdeaTripIdStmt.get(req.params.id) as
        { id: number; trip_id: number } | undefined;
      if (!idea) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, idea.trip_id, req.session.userId)) return;

      const result = insertIdeaCommentStmt.run(
        req.params.id,
        req.session.userId,
        req.body.content,
        new Date().toISOString()
      );
      recordActivity(idea.trip_id, 'ideas', idea.id, 'commented', req.session.userId!);
      reply.code(201);
      return selectIdeaCommentByIdStmt.get(result.lastInsertRowid);
    }
  );

  app.delete<{ Params: { id: string } }>('/ideas/comments/:id', async (req, reply) => {
    const comment = selectIdeaCommentAuthStmt.get(req.params.id) as
      { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
    if (comment.author_id !== req.session.userId) {
      return reply
        .code(403)
        .send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    deleteIdeaCommentStmt.run(req.params.id);
    return reply.code(204).send();
  });
};
