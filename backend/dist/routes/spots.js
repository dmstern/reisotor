import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { fetchPlacePreview, resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
/** Bestimmt, wie die verknüpfte Budget-Ausgabe aussehen soll, ohne bereits zu löschen – eine ggf.
 *  verwaiste alte Ausgabe wird erst gelöscht, NACHDEM die spots-Zeile nicht mehr per Foreign Key
 *  darauf verweist (sonst SQLITE_CONSTRAINT_FOREIGNKEY). Nur für Spots der Kategorie "Unterkunft"
 *  relevant (ehemals routes/accommodation.ts's planBudgetExpense) – ändert sich die Kategorie weg
 *  von "Unterkunft", greift hasAmount nicht mehr und eine zuvor verknüpfte Ausgabe wird abgeräumt. */
function planBudgetExpense(tripId, existingBudgetExpenseId, body) {
    const hasAmount = body.category === 'Unterkunft' && body.amount != null && body.amount > 0 && body.paid_by_user_id != null;
    if (!hasAmount) {
        return { budgetExpenseId: null, staleIdToDelete: existingBudgetExpenseId };
    }
    const sharedBudgetId = ensureDefaultSharedBudget(tripId);
    if (existingBudgetExpenseId) {
        db.prepare('UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, budget_id = ? WHERE id = ?').run(body.title, 'Unterkunft', body.amount, body.paid_by_user_id, body.start_date ?? null, sharedBudgetId, existingBudgetExpenseId);
        return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
    }
    const result = db
        .prepare(`INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(tripId, body.title, 'Unterkunft', body.amount, body.paid_by_user_id, body.start_date ?? null, 'Automatisch aus Unterkunft-Eintrag', sharedBudgetId);
    return { budgetExpenseId: result.lastInsertRowid, staleIdToDelete: null };
}
export const spotsRoutes = async (app) => {
    app.get('/spots', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare('SELECT * FROM spots WHERE trip_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE')
            .all(req.query.trip_id);
    });
    // Live-Vorschau (Titel/Foto) für ExcursionsView.vue's Spot-Anlegen-Formular, sobald ein Maps-Link
    // eingetippt wurde - kein trip_id-Bezug nötig (liest keine Trip-Daten), daher genügt die globale
    // requireAuth-preHandler-Gruppe (app.ts) ohne zusätzliche requireTripMember-Prüfung.
    app.get('/spots/preview', async (req) => {
        return fetchPlacePreview(req.query.maps_link);
    });
    app.post('/spots', async (req, reply) => {
        const body = req.body;
        const { trip_id, title, category, note, maps_link, is_home } = body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
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
            .prepare(`INSERT INTO spots (
           trip_id, title, image_url, category, note, note_format, maps_link, lat, lng, created_by, is_home,
           address, start_date, end_date, checkin, checkout, contact, amount, paid_by_user_id, budget_expense_id
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(trip_id, title, image_url ?? null, category ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', maps_link ?? null, lat ?? null, lng ?? null, req.session.userId, is_home ? 1 : 0, body.address ?? null, body.start_date ?? null, body.end_date ?? null, body.checkin ?? null, body.checkout ?? null, body.contact ?? null, body.amount ?? null, body.paid_by_user_id ?? null, budgetExpenseId);
        recordActivity(trip_id, 'spots', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM spots WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/spots/:id', async (req, reply) => {
        const existing = db.prepare('SELECT id, trip_id, lat, lng, budget_expense_id FROM spots WHERE id = ?').get(req.params.id);
        if (!existing)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existing.trip_id, req.session.userId))
            return;
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
        if (!image_url && lat != null && lng != null) {
            image_url = tilePreviewUrl(lat, lng);
        }
        const { budgetExpenseId, staleIdToDelete } = planBudgetExpense(existing.trip_id, existing.budget_expense_id, body);
        const isHtml = body.note_format === 'html';
        db.prepare(`UPDATE spots SET title = ?, image_url = ?, category = ?, note = ?, note_format = ?, maps_link = ?, lat = ?, lng = ?, is_home = ?,
         address = ?, start_date = ?, end_date = ?, checkin = ?, checkout = ?, contact = ?, amount = ?,
         paid_by_user_id = ?, budget_expense_id = ?
       WHERE id = ?`).run(title, image_url ?? null, category ?? null, note ? (isHtml ? sanitizeHtml(note) : note) : null, isHtml ? 'html' : 'legacy', maps_link ?? null, lat ?? null, lng ?? null, is_home ? 1 : 0, body.address ?? null, body.start_date ?? null, body.end_date ?? null, body.checkin ?? null, body.checkout ?? null, body.contact ?? null, body.amount ?? null, body.paid_by_user_id ?? null, budgetExpenseId, req.params.id);
        // Erst jetzt löschen: die spots-Zeile verweist nicht mehr auf die alte Ausgabe.
        if (staleIdToDelete) {
            db.prepare('DELETE FROM budget_items WHERE id = ?').run(staleIdToDelete);
        }
        recordActivity(existing.trip_id, 'spots', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
    });
    // "Gemacht"-Status: unabhängiges Flag neben geplant/ungeplant (das weiterhin rein aus verknüpften
    // schedule_items abgeleitet wird) - auch spontane, nie geplante Besuche sollen markierbar sein.
    // Eigener Endpunkt statt Teil von PUT /spots/:id, damit ein Toggle nicht das gesamte Formular
    // (inkl. aller anderen Felder) erneut mitschicken muss - analog zum bestehenden /like-Toggle.
    app.post('/spots/:id/done', async (req, reply) => {
        const spot = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?').get(req.params.id);
        if (!spot)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, spot.trip_id, req.session.userId))
            return;
        const done = req.body.done ? 1 : 0;
        db.prepare('UPDATE spots SET done = ? WHERE id = ?').run(done, req.params.id);
        recordActivity(spot.trip_id, 'spots', spot.id, 'updated', req.session.userId);
        return { done: done === 1 };
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen. excursion_spots-Stationsreferenzen auf den Spot bleiben dabei bewusst
    // bestehen (kein Cleanup mehr nötig) – resolveStation() im Frontend liefert für einen nicht mehr
    // gefundenen (weil ausgeblendeten) Spot ohnehin `null` und die Station verschwindet dadurch
    // automatisch aus jeder Stationsliste, taucht nach dem Wiederherstellen aber unverändert wieder auf.
    // Eine verknüpfte Budget-Ausgabe (nur bei Kategorie "Unterkunft" gesetzt, siehe planBudgetExpense
    // oben) wird dabei mit "weggelöscht" (gleiches Muster wie ehemals routes/accommodation.ts) –
    // routes/trash.ts's restore() macht das beim Wiederherstellen wieder rückgängig.
    app.delete('/spots/:id', async (req, reply) => {
        const existing = db.prepare('SELECT trip_id, budget_expense_id FROM spots WHERE id = ?').get(req.params.id);
        if (!existing)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existing.trip_id, req.session.userId))
            return;
        const now = new Date().toISOString();
        const result = db
            .prepare('UPDATE spots SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(now, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (existing.budget_expense_id) {
            db.prepare('UPDATE budget_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, existing.budget_expense_id);
        }
        recordActivity(existing.trip_id, 'spots', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
    // --- Likes/Kommentare (analog /ideas/likes, /ideas/comments) ---
    app.get('/spots/likes', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT spot_likes.* FROM spot_likes
         JOIN spots ON spots.id = spot_likes.spot_id
         WHERE spots.trip_id = ? AND spots.deleted_at IS NULL`)
            .all(req.query.trip_id);
    });
    app.get('/spots/comments', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT spot_comments.* FROM spot_comments
         JOIN spots ON spots.id = spot_comments.spot_id
         WHERE spots.trip_id = ? AND spots.deleted_at IS NULL
         ORDER BY spot_comments.created_at ASC, spot_comments.id ASC`)
            .all(req.query.trip_id);
    });
    app.post('/spots/:id/like', async (req, reply) => {
        const spot = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?').get(req.params.id);
        if (!spot)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, spot.trip_id, req.session.userId))
            return;
        const existing = db
            .prepare('SELECT id FROM spot_likes WHERE spot_id = ? AND user_id = ?')
            .get(req.params.id, req.session.userId);
        if (existing) {
            db.prepare('DELETE FROM spot_likes WHERE id = ?').run(existing.id);
            return { liked: false };
        }
        db.prepare('INSERT INTO spot_likes (spot_id, user_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.session.userId, new Date().toISOString());
        return { liked: true };
    });
    app.post('/spots/:id/comments', async (req, reply) => {
        const spot = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?').get(req.params.id);
        if (!spot)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, spot.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
            .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
        reply.code(201);
        return db.prepare('SELECT * FROM spot_comments WHERE id = ?').get(result.lastInsertRowid);
    });
    app.delete('/spots/comments/:id', async (req, reply) => {
        const comment = db
            .prepare(`SELECT spot_comments.id, spot_comments.author_id, spots.trip_id FROM spot_comments
         JOIN spots ON spots.id = spot_comments.spot_id
         WHERE spot_comments.id = ?`)
            .get(req.params.id);
        if (!comment)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, comment.trip_id, req.session.userId))
            return;
        if (comment.author_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
        }
        db.prepare('DELETE FROM spot_comments WHERE id = ?').run(req.params.id);
        return reply.code(204).send();
    });
};
