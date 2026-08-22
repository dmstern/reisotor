import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';
import { sanitizeHtml } from '../utils/sanitizeHtml.js';
export const notesRoutes = async (app) => {
    app.get('/notes', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        // Entwürfe (is_draft) sind rein persönlich (#89) - nur für die eigene created_by sichtbar, damit
        // sie nicht schon vor dem Veröffentlichen für andere Trip-Mitglieder in der Liste auftauchen.
        return db
            .prepare('SELECT * FROM notes WHERE trip_id = ? AND deleted_at IS NULL AND (is_draft = 0 OR created_by = ?) ORDER BY created_at DESC, id DESC')
            .all(req.query.trip_id, req.session.userId);
    });
    app.post('/notes', async (req, reply) => {
        const { trip_id, title, content } = req.body;
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const isHtml = req.body.content_format === 'html';
        const now = new Date().toISOString();
        const result = db
            .prepare('INSERT INTO notes (trip_id, title, content, content_format, created_by, created_at, is_draft) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(trip_id, title ?? null, isHtml ? sanitizeHtml(content) : content, isHtml ? 'html' : 'legacy', req.session.userId, now, req.body.is_draft ? 1 : 0);
        recordActivity(trip_id, 'notes', result.lastInsertRowid, 'created', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    });
    app.put('/notes/:id', async (req, reply) => {
        const existingNote = db.prepare('SELECT trip_id, created_by, is_draft FROM notes WHERE id = ?').get(req.params.id);
        if (!existingNote)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingNote.trip_id, req.session.userId))
            return;
        // Ein Entwurf bleibt auch beim Bearbeiten rein persönlich - anders als veröffentlichte Notizen
        // (dort darf jedes Trip-Mitglied mitschreiben) darf ihn nur die anlegende Person anfassen.
        if (existingNote.is_draft && existingNote.created_by !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Entwurf bearbeiten' });
        }
        const { title, content } = req.body;
        const isHtml = req.body.content_format === 'html';
        const now = new Date().toISOString();
        const isDraft = req.body.is_draft !== undefined ? (req.body.is_draft ? 1 : 0) : existingNote.is_draft;
        const result = db
            .prepare('UPDATE notes SET title = ?, content = ?, content_format = ?, updated_at = ?, is_draft = ? WHERE id = ?')
            .run(title ?? null, isHtml ? sanitizeHtml(content) : content, isHtml ? 'html' : 'legacy', now, isDraft, req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingNote.trip_id, 'notes', Number(req.params.id), 'updated', req.session.userId);
        return db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
    });
    // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
    // wirklich zu entfernen.
    app.delete('/notes/:id', async (req, reply) => {
        const existingNote = db.prepare('SELECT trip_id, created_by, is_draft FROM notes WHERE id = ?').get(req.params.id);
        if (!existingNote)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, existingNote.trip_id, req.session.userId))
            return;
        if (existingNote.is_draft && existingNote.created_by !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Entwurf löschen' });
        }
        const result = db
            .prepare('UPDATE notes SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
            .run(new Date().toISOString(), req.params.id);
        if (result.changes === 0)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        recordActivity(existingNote.trip_id, 'notes', Number(req.params.id), 'deleted', req.session.userId);
        return reply.code(204).send();
    });
    app.get('/notes/likes', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT note_likes.* FROM note_likes
         JOIN notes ON notes.id = note_likes.note_id
         WHERE notes.trip_id = ? AND notes.deleted_at IS NULL`)
            .all(req.query.trip_id);
    });
    app.get('/notes/comments', async (req, reply) => {
        if (!req.query.trip_id)
            return reply.code(400).send({ error: 'trip_id erforderlich' });
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        return db
            .prepare(`SELECT note_comments.* FROM note_comments
         JOIN notes ON notes.id = note_comments.note_id
         WHERE notes.trip_id = ? AND notes.deleted_at IS NULL
         ORDER BY note_comments.created_at ASC, note_comments.id ASC`)
            .all(req.query.trip_id);
    });
    app.post('/notes/:id/like', async (req, reply) => {
        const note = db.prepare('SELECT id, trip_id FROM notes WHERE id = ?').get(req.params.id);
        if (!note)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, note.trip_id, req.session.userId))
            return;
        const existing = db
            .prepare('SELECT id FROM note_likes WHERE note_id = ? AND user_id = ?')
            .get(req.params.id, req.session.userId);
        if (existing) {
            db.prepare('DELETE FROM note_likes WHERE id = ?').run(existing.id);
            return { liked: false };
        }
        db.prepare('INSERT INTO note_likes (note_id, user_id, created_at) VALUES (?, ?, ?)').run(req.params.id, req.session.userId, new Date().toISOString());
        // Nur beim Liken selbst, nicht beim Zurücknehmen (#97, Notification-Inbox) - ein Un-Like ist kein
        // neues, benachrichtigungswürdiges Ereignis.
        recordActivity(note.trip_id, 'notes', note.id, 'liked', req.session.userId);
        return { liked: true };
    });
    app.post('/notes/:id/comments', async (req, reply) => {
        const note = db.prepare('SELECT id, trip_id FROM notes WHERE id = ?').get(req.params.id);
        if (!note)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, note.trip_id, req.session.userId))
            return;
        const result = db
            .prepare('INSERT INTO note_comments (note_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
            .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
        recordActivity(note.trip_id, 'notes', note.id, 'commented', req.session.userId);
        reply.code(201);
        return db.prepare('SELECT * FROM note_comments WHERE id = ?').get(result.lastInsertRowid);
    });
    app.delete('/notes/comments/:id', async (req, reply) => {
        const comment = db
            .prepare(`SELECT note_comments.id, note_comments.author_id, notes.trip_id FROM note_comments
         JOIN notes ON notes.id = note_comments.note_id
         WHERE note_comments.id = ?`)
            .get(req.params.id);
        if (!comment)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, comment.trip_id, req.session.userId))
            return;
        if (comment.author_id !== req.session.userId) {
            return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
        }
        db.prepare('DELETE FROM note_comments WHERE id = ?').run(req.params.id);
        return reply.code(204).send();
    });
};
