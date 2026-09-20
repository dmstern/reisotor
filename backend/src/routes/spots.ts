import type { FastifyPluginAsync } from 'fastify';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { fetchPlacePreview, resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';

interface SpotBody {
  trip_id: number;
  title: string;
  image_url?: string;
  category?: string;
  note?: string;
  note_format?: 'html' | 'legacy';
  maps_link?: string;
  lat?: number;
  lng?: number;
  /** Heimat-Seite eines Orts (Flughafen/Bahnhof/Zuhause/…), unabhängig von der Kategorie – ein
   *  Flughafen kann sowohl der heimische Abflughafen als auch der Zielflughafen sein. Nur für Touren
   *  mit gesetzter role (ehemalige Reise-Etappen, siehe routes/ideas.ts) relevant, bei gewöhnlichen
   *  Spots ungenutzt. */
  is_home?: boolean;
  // Zusatzfelder für Spots der Kategorie "Unterkunft" (siehe Migrationskommentar in db/index.ts,
  // Verschmelzung von accommodation in spots) – bei anderen Kategorien ungenutzt.
  address?: string;
  start_date?: string;
  end_date?: string;
  checkin?: string;
  checkout?: string;
  contact?: string;
  amount?: number;
  paid_by_user_id?: number | null;
}

interface SpotRow {
  id: number;
  trip_id: number;
  lat: number | null;
  lng: number | null;
  category: string | null;
  budget_expense_id: number | null;
}

interface CommentBody {
  content: string;
}

/** Bestimmt, wie die verknüpfte Budget-Ausgabe aussehen soll, ohne bereits zu löschen – eine ggf.
 *  verwaiste alte Ausgabe wird erst gelöscht, NACHDEM die spots-Zeile nicht mehr per Foreign Key
 *  darauf verweist (sonst SQLITE_CONSTRAINT_FOREIGNKEY). Nur für Spots der Kategorie "Unterkunft"
 *  relevant (ehemals routes/accommodation.ts's planBudgetExpense) – ändert sich die Kategorie weg
 *  von "Unterkunft", greift hasAmount nicht mehr und eine zuvor verknüpfte Ausgabe wird abgeräumt. */
function planBudgetExpense(tripId: number, existingBudgetExpenseId: number | null, body: SpotBody) {
  const hasAmount =
    body.category === 'Unterkunft' &&
    body.amount != null &&
    body.amount > 0 &&
    body.paid_by_user_id != null;

  if (!hasAmount) {
    return { budgetExpenseId: null as number | null, staleIdToDelete: existingBudgetExpenseId };
  }

  const sharedBudgetId = ensureDefaultSharedBudget(tripId);

  if (existingBudgetExpenseId) {
    db.prepare(
      'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, budget_id = ? WHERE id = ?'
    ).run(
      body.title,
      'Unterkunft',
      body.amount,
      body.paid_by_user_id,
      body.start_date ?? null,
      sharedBudgetId,
      existingBudgetExpenseId
    );
    return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
  }

  const result = db
    .prepare(
      `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tripId,
      body.title,
      'Unterkunft',
      body.amount,
      body.paid_by_user_id,
      body.start_date ?? null,
      'Automatisch aus Unterkunft-Eintrag',
      sharedBudgetId
    );
  return { budgetExpenseId: result.lastInsertRowid as number, staleIdToDelete: null };
}

// Top-level pre-compiled statements for hot paths
const selectSpotsByTripStmt = db.prepare(
  'SELECT * FROM spots WHERE trip_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE'
);
const selectSpotByIdStmt = db.prepare('SELECT * FROM spots WHERE id = ?');
const selectSpotForUpdateStmt = db.prepare(
  'SELECT id, trip_id, lat, lng, budget_expense_id FROM spots WHERE id = ?'
);
const selectSpotTripIdStmt = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?');
const selectSpotForDeleteStmt = db.prepare(
  'SELECT trip_id, budget_expense_id FROM spots WHERE id = ?'
);
const softDeleteSpotStmt = db.prepare(
  'UPDATE spots SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
);
const softDeleteBudgetItemStmt = db.prepare(
  'UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL'
);
const deleteBudgetItemStmt = db.prepare('DELETE FROM budget_items WHERE id = ?');

const selectSpotLikeStmt = db.prepare(
  'SELECT id FROM spot_likes WHERE spot_id = ? AND user_id = ?'
);
const deleteSpotLikeStmt = db.prepare('DELETE FROM spot_likes WHERE id = ?');
const insertSpotLikeStmt = db.prepare(
  'INSERT INTO spot_likes (spot_id, user_id, created_at) VALUES (?, ?, ?)'
);

const insertSpotCommentStmt = db.prepare(
  'INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)'
);
const selectSpotCommentByIdStmt = db.prepare(
  `SELECT spot_comments.*,
     (SELECT COUNT(*) FROM spot_comment_likes WHERE comment_id = spot_comments.id) AS like_count,
     CASE WHEN EXISTS (
       SELECT 1 FROM spot_comment_likes WHERE comment_id = spot_comments.id AND user_id = ?
     ) THEN 1 ELSE 0 END AS liked
   FROM spot_comments WHERE id = ?`
);
const selectSpotCommentsByTripStmt = db.prepare(
  `SELECT spot_comments.*,
     (SELECT COUNT(*) FROM spot_comment_likes WHERE comment_id = spot_comments.id) AS like_count,
     CASE WHEN EXISTS (
       SELECT 1 FROM spot_comment_likes WHERE comment_id = spot_comments.id AND user_id = ?
     ) THEN 1 ELSE 0 END AS liked
   FROM spot_comments
   JOIN spots ON spots.id = spot_comments.spot_id
   WHERE spots.trip_id = ? AND spots.deleted_at IS NULL
   ORDER BY spot_comments.created_at ASC, spot_comments.id ASC`
);
const selectSpotCommentWithTripStmt = db.prepare(
  `SELECT spot_comments.id, spot_comments.author_id, spots.trip_id FROM spot_comments
   JOIN spots ON spots.id = spot_comments.spot_id
   WHERE spot_comments.id = ?`
);
const deleteSpotCommentStmt = db.prepare('DELETE FROM spot_comments WHERE id = ?');
const updateSpotCommentStmt = db.prepare(
  'UPDATE spot_comments SET content = ?, updated_at = ? WHERE id = ?'
);
const selectSpotCommentLikeStmt = db.prepare(
  'SELECT id FROM spot_comment_likes WHERE comment_id = ? AND user_id = ?'
);
const insertSpotCommentLikeStmt = db.prepare(
  'INSERT INTO spot_comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)'
);
const deleteSpotCommentLikeStmt = db.prepare('DELETE FROM spot_comment_likes WHERE id = ?');
const countSpotCommentLikesStmt = db.prepare(
  'SELECT COUNT(*) as count FROM spot_comment_likes WHERE comment_id = ?'
);

const hasScheduleDateStmt = db.prepare(
  `SELECT 1 FROM schedule_items WHERE spot_id = ? AND deleted_at IS NULL
   UNION
   SELECT 1 FROM schedule_items
     JOIN excursion_spots ON excursion_spots.idea_id = schedule_items.idea_id
     WHERE excursion_spots.spot_id = ? AND schedule_items.deleted_at IS NULL
   LIMIT 1`
);
const updateSpotDoneStmt = db.prepare('UPDATE spots SET done = ? WHERE id = ?');
const updateScheduleDoneBySpotStmt = db.prepare(
  'UPDATE schedule_items SET done = ? WHERE spot_id = ? AND deleted_at IS NULL'
);

export const spotsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/spots', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return selectSpotsByTripStmt.all(req.query.trip_id);
  });

  // SECURITY AUDIT (Sentinel): Live-Vorschau (Titel/Foto) für ExcursionsView.vue's Spot-Anlegen-Formular,
  // sobald ein Maps-Link eingetippt wurde. Dieser Endpunkt erfordert zwar Authentifizierung (via requireAuth in app.ts),
  // hat aber bewusst keinen trip_id-Bezug, da er lediglich ein öffentliches Vorschau-Snippet aus einem Link auflöst
  // und keine Datenbank- oder Trip-Daten liest. Daher ist requireTripMember hier nicht erforderlich.
  app.get<{ Querystring: { maps_link?: string } }>('/spots/preview', async (req) => {
    return fetchPlacePreview(req.query.maps_link);
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const body = req.body;
    const { trip_id, title, category, note, maps_link, is_home } = body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    let { lat, lng, image_url } = body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    // Kein eigenes Bild hinterlegt, aber ein Standort bekannt: automatisches Vorschaubild
    // (Kartenausschnitt) statt eines leeren Platzhalters.
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const { budgetExpenseId } = planBudgetExpense(trip_id, null, body);
    const isHtml = body.note_format === 'html';
    const result = db
      .prepare(
        `INSERT INTO spots (
           trip_id, title, image_url, category, note, note_format, maps_link, lat, lng, created_by, is_home,
           address, start_date, end_date, checkin, checkout, contact, amount, paid_by_user_id, budget_expense_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        trip_id,
        title,
        image_url ?? null,
        category ?? null,
        note ? (isHtml ? sanitizeHtml(note) : note) : null,
        isHtml ? 'html' : 'legacy',
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        req.session.userId,
        is_home ? 1 : 0,
        body.address ?? null,
        body.start_date ?? null,
        body.end_date ?? null,
        body.checkin ?? null,
        body.checkout ?? null,
        body.contact ?? null,
        body.amount ?? null,
        body.paid_by_user_id ?? null,
        budgetExpenseId
      );
    recordActivity(
      trip_id,
      'spots',
      result.lastInsertRowid as number,
      'created',
      req.session.userId!
    );
    reply.code(201);
    return selectSpotByIdStmt.get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: SpotBody }>('/spots/:id', async (req, reply) => {
    const existing = selectSpotForUpdateStmt.get(req.params.id) as SpotRow | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existing.trip_id, req.session.userId)) return;

    const body = req.body;
    const { title, category, note, maps_link, is_home } = body;
    let { lat, lng, image_url } = body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    // Schlägt die (erneute) Auflösung fehl, obwohl weiterhin ein Maps-Link hinterlegt ist,
    // bisherige Koordinaten behalten statt sie zu löschen (siehe gleiches Muster in trips.ts).
    if ((lat == null || lng == null) && maps_link) {
      lat = lat ?? existing.lat ?? undefined;
      lng = lng ?? existing.lng ?? undefined;
    }
    // Wenn lat/lng im Request gar nicht übergeben wurden (undefined), bestehende Koordinaten behalten:
    if (lat === undefined) lat = existing.lat ?? undefined;
    if (lng === undefined) lng = existing.lng ?? undefined;
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const { budgetExpenseId, staleIdToDelete } = planBudgetExpense(
      existing.trip_id,
      existing.budget_expense_id,
      body
    );
    const isHtml = body.note_format === 'html';

    db.prepare(
      `UPDATE spots SET title = ?, image_url = ?, category = ?, note = ?, note_format = ?, maps_link = ?, lat = ?, lng = ?, is_home = ?,
         address = ?, start_date = ?, end_date = ?, checkin = ?, checkout = ?, contact = ?, amount = ?,
         paid_by_user_id = ?, budget_expense_id = ?
       WHERE id = ?`
    ).run(
      title,
      image_url ?? null,
      category ?? null,
      note ? (isHtml ? sanitizeHtml(note) : note) : null,
      isHtml ? 'html' : 'legacy',
      maps_link ?? null,
      lat ?? null,
      lng ?? null,
      is_home ? 1 : 0,
      body.address ?? null,
      body.start_date ?? null,
      body.end_date ?? null,
      body.checkin ?? null,
      body.checkout ?? null,
      body.contact ?? null,
      body.amount ?? null,
      body.paid_by_user_id ?? null,
      budgetExpenseId,
      req.params.id
    );

    // Erst jetzt löschen: die spots-Zeile verweist nicht mehr auf die alte Ausgabe.
    if (staleIdToDelete) {
      deleteBudgetItemStmt.run(staleIdToDelete);
    }

    recordActivity(
      existing.trip_id,
      'spots',
      Number(req.params.id),
      'updated',
      req.session.userId!
    );
    return selectSpotByIdStmt.get(req.params.id);
  });

  // "Gemacht"-Status (#106): setzbar nur, wenn der Spot bereits über einen verknüpften
  // schedule_items-Termin ein Datum trägt - ein Spot/eine Tour darf nicht gleichzeitig "gemacht" UND
  // ohne Datum sein (eindeutige Statuskette in Planung -> geplant -> gemacht). Das Datum selbst wird
  // NICHT hier gesetzt (bleibt Aufgabe des Kalenders/scheduleStore.setSpotDate), das Frontend führt
  // vor einem Aufruf mit done=true immer erst durch den Kalender-Bestätigungs-Flow (SpotCard.vue/
  // ScheduleView.vue), damit ein Datum sicher schon existiert. Eigener Endpunkt statt Teil von
  // PUT /spots/:id, damit ein Toggle nicht das gesamte Formular erneut mitschicken muss - analog zum
  // bestehenden /like-Toggle.
  app.post<{ Params: { id: string }; Body: { done: boolean } }>(
    '/spots/:id/done',
    async (req, reply) => {
      const spot = selectSpotTripIdStmt.get(req.params.id) as
        { id: number; trip_id: number } | undefined;
      if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, spot.trip_id, req.session.userId)) return;

      const done = req.body.done ? 1 : 0;
      if (done) {
        // Zwei Wege zu einem Datum: ein direkt mit dem Spot verknüpfter Termin (normales Einplanen,
        // siehe schedule_items.spot_id, auch DiaryView.vue's "Spots zuordnen"-Picker seit #216) ODER
        // ein Termin über eine Tour, in der dieser Spot als Station steckt (z. B. routes/ideas.ts's
        // plan-spot).
        const hasDate = hasScheduleDateStmt.get(req.params.id, req.params.id);
        if (!hasDate) {
          return reply
            .code(400)
            .send({ error: 'Für den Status "gemacht" muss zuerst ein Datum gesetzt werden.' });
        }
      }
      updateSpotDoneStmt.run(done, req.params.id);
      updateScheduleDoneBySpotStmt.run(done, req.params.id);
      recordActivity(spot.trip_id, 'spots', spot.id, 'updated', req.session.userId!);
      return { done: done === 1 };
    }
  );

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen. excursion_spots-Stationsreferenzen auf den Spot bleiben dabei bewusst
  // bestehen (kein Cleanup mehr nötig) – resolveStation() im Frontend liefert für einen nicht mehr
  // gefundenen (weil ausgeblendeten) Spot ohnehin `null` und die Station verschwindet dadurch
  // automatisch aus jeder Stationsliste, taucht nach dem Wiederherstellen aber unverändert wieder auf.
  // Eine verknüpfte Budget-Ausgabe (nur bei Kategorie "Unterkunft" gesetzt, siehe planBudgetExpense
  // oben) wird dabei mit "weggelöscht" (gleiches Muster wie ehemals routes/accommodation.ts) –
  // routes/trash.ts's restore() macht das beim Wiederherstellen wieder rückgängig.
  app.delete<{ Params: { id: string } }>('/spots/:id', async (req, reply) => {
    const existing = selectSpotForDeleteStmt.get(req.params.id) as
      { trip_id: number; budget_expense_id: number | null } | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existing.trip_id, req.session.userId)) return;

    const now = new Date().toISOString();
    const result = softDeleteSpotStmt.run(now, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (existing.budget_expense_id) {
      softDeleteBudgetItemStmt.run(now, existing.budget_expense_id);
    }
    recordActivity(
      existing.trip_id,
      'spots',
      Number(req.params.id),
      'deleted',
      req.session.userId!
    );
    return reply.code(204).send();
  });

  // --- Likes/Kommentare (analog /ideas/likes, /ideas/comments) ---

  app.get<{ Querystring: { trip_id?: string } }>('/spots/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT spot_likes.* FROM spot_likes
         JOIN spots ON spots.id = spot_likes.spot_id
         WHERE spots.trip_id = ? AND spots.deleted_at IS NULL`
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/spots/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return selectSpotCommentsByTripStmt.all(req.session.userId ?? null, req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/spots/:id/like', async (req, reply) => {
    const spot = selectSpotTripIdStmt.get(req.params.id) as
      { id: number; trip_id: number } | undefined;
    if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, spot.trip_id, req.session.userId)) return;

    const existing = selectSpotLikeStmt.get(req.params.id, req.session.userId) as
      { id: number } | undefined;

    if (existing) {
      deleteSpotLikeStmt.run(existing.id);
      return { liked: false };
    }

    insertSpotLikeStmt.run(req.params.id, req.session.userId, new Date().toISOString());
    // Nur beim Liken selbst, nicht beim Zurücknehmen (#97, Notification-Inbox) - ein Un-Like ist kein
    // neues, benachrichtigungswürdiges Ereignis.
    recordActivity(spot.trip_id, 'spots', spot.id, 'liked', req.session.userId!);
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>(
    '/spots/:id/comments',
    async (req, reply) => {
      const spot = selectSpotTripIdStmt.get(req.params.id) as
        { id: number; trip_id: number } | undefined;
      if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, spot.trip_id, req.session.userId)) return;

      const result = insertSpotCommentStmt.run(
        req.params.id,
        req.session.userId,
        req.body.content,
        new Date().toISOString()
      );
      recordActivity(spot.trip_id, 'spots', spot.id, 'commented', req.session.userId!);
      reply.code(201);
      return selectSpotCommentByIdStmt.get(req.session.userId ?? null, result.lastInsertRowid);
    }
  );

  app.delete<{ Params: { id: string } }>('/spots/comments/:id', async (req, reply) => {
    const comment = selectSpotCommentWithTripStmt.get(req.params.id) as
      { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
    if (comment.author_id !== req.session.userId) {
      return reply
        .code(403)
        .send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    deleteSpotCommentStmt.run(req.params.id);
    return reply.code(204).send();
  });

  app.put<{ Params: { id: string }; Body: CommentBody }>(
    '/spots/comments/:id',
    async (req, reply) => {
      const content = req.body?.content?.trim();
      if (!content) return reply.code(400).send({ error: 'Inhalt darf nicht leer sein' });
      const comment = selectSpotCommentWithTripStmt.get(req.params.id) as
        { id: number; author_id: number; trip_id: number } | undefined;
      if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
      if (comment.author_id !== req.session.userId) {
        return reply
          .code(403)
          .send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar bearbeiten' });
      }
      updateSpotCommentStmt.run(content, new Date().toISOString(), req.params.id);
      return selectSpotCommentByIdStmt.get(req.session.userId ?? null, req.params.id);
    }
  );

  app.post<{ Params: { id: string } }>('/spots/comments/:id/like', async (req, reply) => {
    const comment = selectSpotCommentWithTripStmt.get(req.params.id) as
      { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;

    const existing = selectSpotCommentLikeStmt.get(req.params.id, req.session.userId) as
      { id: number } | undefined;

    let liked: boolean;
    if (existing) {
      deleteSpotCommentLikeStmt.run(existing.id);
      liked = false;
    } else {
      insertSpotCommentLikeStmt.run(req.params.id, req.session.userId, new Date().toISOString());
      recordActivity(comment.trip_id, 'spots', comment.id, 'liked', req.session.userId!);
      liked = true;
    }

    const countRow = countSpotCommentLikesStmt.get(req.params.id) as { count: number };
    return { liked, like_count: countRow.count };
  });
};
