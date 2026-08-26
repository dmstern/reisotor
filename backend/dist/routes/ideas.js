import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
// Welche Spots zu welcher Tour gehören, in welcher Reihenfolge (Batch 13, Reihenfolge/Mehrfach-
// besuche nachgerüstet; Batch 14: generischer station_key statt spot_id, für Unterkunft-/Reise-
// Etappen-Enden ohne eigenen Spot). station_key wich zwischenzeitlich einer echten spot_id-Fremd-
// schlüsselspalte (siehe Migrationskommentar in db/index.ts) – Reihenfolge (position) und
// Mehrfachbesuch (derselbe Spot z. B. als Start UND Ende eines Rundgangs) bleiben aber bewusst
// erhalten, da zwei UI-Modi (einfaches Tagging vs. "Erweiterte Touren-Bearbeitung", siehe
// ProfileView.vue) sich dasselbe Datenmodell teilen. spot_ids ist daher weiterhin ein geordnetes
// Array (Duplikate erlaubt), nicht nur eine Menge. Wird bei jedem Anlegen/Bearbeiten komplett neu
// geschrieben (einfacher als Diffing) – kleine Anzahl Zeilen pro Tour.
function syncExcursionSpots(ideaId, spotIds) {
    db.prepare('DELETE FROM excursion_spots WHERE idea_id = ?').run(ideaId);
    const insert = db.prepare('INSERT INTO excursion_spots (idea_id, spot_id, position) VALUES (?, ?, ?)');
    spotIds.forEach((spotId, index) => insert.run(ideaId, spotId, index));
}
function spotIdsFor(ideaIds) {
    const map = new Map();
    if (!ideaIds.length)
        return map;
    const placeholders = ideaIds.map(() => '?').join(',');
    const rows = db
        .prepare(`SELECT idea_id, spot_id FROM excursion_spots WHERE idea_id IN (${placeholders}) ORDER BY idea_id, position`)
        .all(...ideaIds);
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
function scheduleDatesForIdeas(ideaIds) {
    const map = new Map();
    if (!ideaIds.length)
        return map;
    const placeholders = ideaIds.map(() => '?').join(',');
    const rows = db
        .prepare(`SELECT idea_id, date FROM schedule_items WHERE idea_id IN (${placeholders}) AND deleted_at IS NULL`)
        .all(...ideaIds);
    for (const row of rows)
        map.set(row.idea_id, row.date);
    return map;
}
// Legt den Kalender-Termin an/aktualisiert/löscht ihn, der einen Ausflug im Kalender repräsentiert
// – ersetzt die frühere eigene Datums-Spalte auf "ideas". Sowohl das Datum-Feld im Ausflug-
// Formular (ExcursionsView.vue) als auch das Ziehen auf einen Kalendertag (excursionsStore.
// setDate) laufen über denselben PUT/POST /ideas-Endpunkt und landen daher hier – EIN Mechanismus
// statt zweier, wie es vor der Einführung des separaten "Ein-Spot-Ausflug"-Hacks für Spots war.
function setIdeaScheduleDate(ideaId, tripId, title, date, userId) {
    const existing = db
        .prepare('SELECT id FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL')
        .get(ideaId);
    if (date) {
        if (existing) {
            db.prepare('UPDATE schedule_items SET date = ?, title = ? WHERE id = ?').run(date, title, existing.id);
            if (userId)
                recordActivity(tripId, 'schedule', existing.id, 'updated', userId);
        }
        else {
            const result = db
                .prepare('INSERT INTO schedule_items (trip_id, date, title, idea_id) VALUES (?, ?, ?, ?)')
                .run(tripId, date, title, ideaId);
            if (userId)
                recordActivity(tripId, 'schedule', result.lastInsertRowid, 'created', userId);
        }
    }
    else if (existing) {
        db.prepare('DELETE FROM schedule_items WHERE id = ?').run(existing.id);
        if (userId)
            recordActivity(tripId, 'schedule', existing.id, 'deleted', userId);
    }
}
function serializeIdea(row, spotIds, date) {
    return { ...row, spot_ids: spotIds, date };
}
/** Budget-Sync für Touren mit gesetztem role (ehemalige Reise-Etappen) - Gegenstück zu
 *  routes/travel.ts's planBudgetExpense() vor #176, gleiches Muster wie dort: legt die verknüpfte
 *  Ausgabe an/aktualisiert sie, löscht aber noch NICHT die alte Ausgabe (staleIdToDelete), damit der
 *  Aufrufer sie erst löscht, NACHDEM die ideas-Zeile nicht mehr per Foreign Key darauf verweist
 *  (sonst SQLITE_CONSTRAINT_FOREIGNKEY). Nur Touren mit amount+paid_by_user_id bekommen überhaupt
 *  eine Ausgabe - eine normale Tour ohne diese Felder bleibt unangetastet (budgetExpenseId bleibt
 *  null, kein Aufruf nötig, Aufrufer prüft das selbst). */
function planIdeaBudgetExpense(tripId, existingBudgetExpenseId, title, date, amount, paidByUserId) {
    const hasAmount = amount != null && amount > 0 && paidByUserId != null;
    if (!hasAmount) {
        return { budgetExpenseId: null, staleIdToDelete: existingBudgetExpenseId };
    }
    const sharedBudgetId = ensureDefaultSharedBudget(tripId);
    if (existingBudgetExpenseId) {
        db.prepare('UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, budget_id = ? WHERE id = ?').run(title, 'Transport', amount, paidByUserId, date ?? null, sharedBudgetId, existingBudgetExpenseId);
        return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
    }
    const result = db
        .prepare(`INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(tripId, title, 'Transport', amount, paidByUserId, date ?? null, 'Automatisch aus Tour', sharedBudgetId);
    return { budgetExpenseId: result.lastInsertRowid, staleIdToDelete: null };
}
export const ideasRoutes = async (app) => {
    app.get('/ideas', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const rows = db
            .prepare('SELECT * FROM ideas WHERE trip_id = ? AND deleted_at IS NULL ORDER BY id DESC')
            .all(req.query.trip_id);
        const spotIds = spotIdsFor(rows.map((r) => r.id));
        const dates = scheduleDatesForIdeas(rows.map((r) => r.id));
        return rows.map((row) => serializeIdea(row, spotIds.get(row.id) ?? [], dates.get(row.id) ?? null));
    });
    app.post('/ideas', async (req, reply) => {
        const { trip_id, title, image_url, note, date, spot_ids, role, transport_type, departure_time, arrival_time, checkin_info, amount, paid_by_user_id, luggage, seat, ticket_link, } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        // Rolle (Anreise/Abreise/Weiterreise) nur mit genau zwei Stationen (Von/Nach) - siehe
        // Konzept-Entscheidung in Issue #68/#176. Eine normale Tour (role nicht gesetzt) bleibt frei in
        // der Stationsanzahl.
        if (role && (spot_ids?.length ?? 0) !== 2) {
            return reply.code(400).send({
                error: 'Eine Tour mit Rolle (Anreise/Abreise/Weiterreise) braucht genau zwei Stationen (Von/Nach).',
            });
        }
        const isHtml = req.body.note_format === 'html';
        const { budgetExpenseId } = planIdeaBudgetExpense(trip_id, null, title, date, amount, paid_by_user_id);
        const result = db
            .prepare(`INSERT INTO ideas (
          trip_id, title, image_url, note, note_format, created_by,
          role, transport_type, departure_time, arrival_time, checkin_info,
          amount, paid_by_user_id, luggage, seat, ticket_link, budget_expense_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(trip_id, title, image_url ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', req.session.userId, role ?? null, transport_type ?? null, departure_time ?? null, arrival_time ?? null, checkin_info ?? null, amount ?? null, paid_by_user_id ?? null, luggage ?? null, seat ?? null, ticket_link ?? null, budgetExpenseId);
        const ideaId = result.lastInsertRowid;
        syncExcursionSpots(ideaId, spot_ids ?? []);
        setIdeaScheduleDate(ideaId, trip_id, title, date, req.session.userId);
        recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId);
        reply.code(201);
        const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        return serializeIdea(row, spot_ids ?? [], date ?? null);
    });
    app.put('/ideas/:id', async (req, reply) => {
        const existingIdea = db
            .prepare('SELECT trip_id, budget_expense_id FROM ideas WHERE id = ?')
            .get(req.params.id);
        if (!existingIdea)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId))
            return;
        const { title, image_url, note, date, spot_ids, role, transport_type, departure_time, arrival_time, checkin_info, amount, paid_by_user_id, luggage, seat, ticket_link, } = req.body;
        if (role && (spot_ids?.length ?? 0) !== 2) {
            return reply.code(400).send({
                error: 'Eine Tour mit Rolle (Anreise/Abreise/Weiterreise) braucht genau zwei Stationen (Von/Nach).',
            });
        }
        const isHtml = req.body.note_format === 'html';
        const { budgetExpenseId, staleIdToDelete } = planIdeaBudgetExpense(existingIdea.trip_id, existingIdea.budget_expense_id, title, date, amount, paid_by_user_id);
        const result = db
            .prepare(`UPDATE ideas SET title = ?, image_url = ?, note = ?, note_format = ?,
          role = ?, transport_type = ?, departure_time = ?, arrival_time = ?, checkin_info = ?,
          amount = ?, paid_by_user_id = ?, luggage = ?, seat = ?, ticket_link = ?, budget_expense_id = ?
         WHERE id = ?`)
            .run(title, image_url ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', role ?? null, transport_type ?? null, departure_time ?? null, arrival_time ?? null, checkin_info ?? null, amount ?? null, paid_by_user_id ?? null, luggage ?? null, seat ?? null, ticket_link ?? null, budgetExpenseId, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        // Erst jetzt löschen: die ideas-Zeile verweist nicht mehr auf die alte Ausgabe (gleiches Muster
        // wie zuvor in routes/travel.ts).
        if (staleIdToDelete) {
            db.prepare('DELETE FROM budget_items WHERE id = ?').run(staleIdToDelete);
        }
        const ideaId = Number(req.params.id);
        syncExcursionSpots(ideaId, spot_ids ?? []);
        const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        setIdeaScheduleDate(ideaId, row.trip_id, title, date, req.session.userId);
        recordActivity(existingIdea.trip_id, 'ideas', ideaId, 'updated', req.session.userId);
        return serializeIdea(row, spot_ids ?? [], date ?? null);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeilen
    // wirklich zu entfernen. Der verknüpfte Kalender-Termin (schedule_items.idea_id) UND (seit #176)
    // eine verknüpfte Budget-Ausgabe (ehemalige Reise-Etappe) werden dabei mit "weggelöscht" – sonst
    // blieben sie als Karteileichen sichtbar, während der Ausflug selbst im Papierkorb liegt.
    // routes/trash.ts's restore() macht beide Kopplungen beim Wiederherstellen wieder rückgängig.
    app.delete('/ideas/:id', async (req, reply) => {
        const existingIdea = db
            .prepare('SELECT trip_id, budget_expense_id FROM ideas WHERE id = ?')
            .get(req.params.id);
        if (!existingIdea)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingIdea.trip_id, req.session.userId))
            return;
        let linkedScheduleItems = [];
        const deleteWithSchedule = db.transaction((id) => {
            const now = new Date().toISOString();
            linkedScheduleItems = db
                .prepare('SELECT id FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL')
                .all(id);
            db.prepare('UPDATE schedule_items SET deleted_at = ? WHERE idea_id = ? AND deleted_at IS NULL').run(now, id);
            if (existingIdea.budget_expense_id) {
                db.prepare('UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, existingIdea.budget_expense_id);
            }
            return db
                .prepare('UPDATE ideas SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
                .run(now, id);
        });
        const result = deleteWithSchedule(req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        for (const item of linkedScheduleItems) {
            recordActivity(existingIdea.trip_id, 'schedule', item.id, 'deleted', req.session.userId);
        }
        recordActivity(existingIdea.trip_id, 'ideas', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
    // "Gemacht"-Status (#106): setzbar nur, wenn die Tour bereits über einen verknüpften
    // schedule_items-Termin ein Datum trägt - eindeutige Statuskette in Planung -> geplant -> gemacht
    // statt (wie zuvor) unabhängiger Flags. Das Datum selbst wird NICHT hier gesetzt (bleibt Aufgabe
    // von PUT /ideas/:id bzw. excursionsStore.setDate), das Frontend führt vor einem Aufruf mit
    // done=true immer erst durch den Kalender-Bestätigungs-Flow (ExcursionCard.vue/ScheduleView.vue).
    // Eigener Endpunkt statt Teil von PUT /ideas/:id, damit ein Toggle nicht das gesamte Formular
    // erneut mitschicken muss - analog zum bestehenden /like-Toggle.
    app.post('/ideas/:id/done', async (req, reply) => {
        const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id);
        if (!idea)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, idea.trip_id, req.session.userId))
            return;
        const done = req.body.done ? 1 : 0;
        if (done) {
            const hasDate = db
                .prepare('SELECT 1 FROM schedule_items WHERE idea_id = ? AND deleted_at IS NULL LIMIT 1')
                .get(req.params.id);
            if (!hasDate) {
                return reply
                    .code(400)
                    .send({ error: 'Für den Status "gemacht" muss zuerst ein Datum gesetzt werden.' });
            }
        }
        db.prepare('UPDATE ideas SET done = ? WHERE id = ?').run(done, req.params.id);
        recordActivity(idea.trip_id, 'ideas', idea.id, 'updated', req.session.userId);
        return { done: done === 1 };
    });
    // Spontanes Einplanen eines einzelnen Spots als Ein-Spot-Ausflug, OHNE dass vorher ein Ausflug
    // angelegt werden muss. NICHT der Weg, auf dem ein Spot im KALENDER eingeplant wird (das erzeugt
    // einen direkt mit dem Spot verknüpften Termin, siehe routes/schedule.ts) – DiaryView.vue's
    // Spot-Picker nutzte diesen Endpunkt bis #216 dafür, verknüpft Spots inzwischen direkt (siehe
    // diary_spots), der Endpunkt bleibt aber als generischer Weg bestehen, einen Spot spontan als
    // eigenen (Ein-Stations-)Ausflug einzuplanen. Dedupe-Check (exakt EINE Station mit demselben Spot
    // an trip_id+Termin-Datum) verhindert Duplikate, wenn derselbe Spot mehrfach für denselben Tag
    // ausgelöst wird – zwei VERSCHIEDENE Spots am selben Tag erzeugen dagegen bewusst je einen
    // eigenen Ausflug (kein Zusammenlegen).
    app.post('/ideas/plan-spot', async (req, reply) => {
        const { trip_id, spot_id, date } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const candidates = db
            .prepare(`SELECT ideas.id AS id FROM ideas
         JOIN schedule_items ON schedule_items.idea_id = ideas.id
         WHERE ideas.trip_id = ? AND ideas.deleted_at IS NULL AND schedule_items.deleted_at IS NULL
           AND schedule_items.date = ?`)
            .all(trip_id, date);
        let existing;
        if (candidates.length) {
            const placeholders = candidates.map(() => '?').join(',');
            existing = db
                .prepare(`SELECT idea_id AS id FROM excursion_spots
           WHERE idea_id IN (${placeholders})
           GROUP BY idea_id
           HAVING COUNT(*) = 1 AND MAX(spot_id) = ?`)
                .get(...candidates.map((c) => c.id), spot_id);
        }
        if (existing) {
            const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(existing.id);
            return serializeIdea(row, [spot_id], date);
        }
        const spot = db
            .prepare('SELECT title FROM spots WHERE id = ? AND deleted_at IS NULL')
            .get(spot_id);
        if (!spot)
            return reply.code(404).send({ error: 'Spot nicht gefunden' });
        const result = db
            .prepare('INSERT INTO ideas (trip_id, title, created_by) VALUES (?, ?, ?)')
            .run(trip_id, spot.title, req.session.userId);
        const ideaId = result.lastInsertRowid;
        syncExcursionSpots(ideaId, [spot_id]);
        setIdeaScheduleDate(ideaId, trip_id, spot.title, date, req.session.userId);
        recordActivity(trip_id, 'ideas', ideaId, 'created', req.session.userId);
        reply.code(201);
        const row = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
        return serializeIdea(row, [spot_id], date);
    });
    app.get('/ideas/likes', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT idea_likes.* FROM idea_likes
         JOIN ideas ON ideas.id = idea_likes.idea_id
         WHERE ideas.trip_id = ?`)
            .all(req.query.trip_id);
    });
    app.get('/ideas/comments', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT idea_comments.* FROM idea_comments
         JOIN ideas ON ideas.id = idea_comments.idea_id
         WHERE ideas.trip_id = ?
         ORDER BY idea_comments.created_at ASC, idea_comments.id ASC`)
            .all(req.query.trip_id);
    });
    app.post('/ideas/:id/like', async (req, reply) => {
        const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id);
        if (!idea)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, idea.trip_id, req.session.userId))
            return;
        const existing = db
            .prepare('SELECT id FROM idea_likes WHERE idea_id = ? AND user_id = ?')
            .get(req.params.id, req.session.userId);
        if (existing) {
            db.prepare('DELETE FROM idea_likes WHERE id = ?').run(existing.id);
            return { liked: false };
        }
        db.prepare('INSERT INTO idea_likes (idea_id, user_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.session.userId, new Date().toISOString());
        // Nur beim Liken selbst, nicht beim Zurücknehmen (#97, Notification-Inbox) - ein Un-Like ist kein
        // neues, benachrichtigungswürdiges Ereignis.
        recordActivity(idea.trip_id, 'ideas', idea.id, 'liked', req.session.userId);
        return { liked: true };
    });
    app.post('/ideas/:id/comments', async (req, reply) => {
        const idea = db.prepare('SELECT id, trip_id FROM ideas WHERE id = ?').get(req.params.id);
        if (!idea)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, idea.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('INSERT INTO idea_comments (idea_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
            .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
        recordActivity(idea.trip_id, 'ideas', idea.id, 'commented', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM idea_comments WHERE id = ?').get(result.lastInsertRowid);
    });
    app.delete('/ideas/comments/:id', async (req, reply) => {
        const comment = db
            .prepare(`SELECT idea_comments.id, idea_comments.author_id, ideas.trip_id FROM idea_comments
         JOIN ideas ON ideas.id = idea_comments.idea_id
         WHERE idea_comments.id = ?`)
            .get(req.params.id);
        if (!comment)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, comment.trip_id, req.session.userId))
            return;
        if (comment.author_id !== req.session.userId) {
            return reply
                .code(403)
                .send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
        }
        db.prepare('DELETE FROM idea_comments WHERE id = ?').run(req.params.id);
        return reply.code(204).send();
    });
};
