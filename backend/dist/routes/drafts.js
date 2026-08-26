import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
// Zwischenspeicher für noch nicht abgeschickte Create-/Edit-Formulare (siehe db/index.ts's
// drafts-Tabelle, frontend/src/composables/useDraftAutosave.ts). Rein persönlich: jede Route filtert
// zusätzlich zu requireTripMember() nach der eigenen user_id, ein Entwurf ist nie für andere
// Mitglieder sichtbar.
export const draftsRoutes = async (app) => {
    app.get('/drafts', async (req, reply) => {
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const rows = db
            .prepare('SELECT draft_key, data, updated_at FROM drafts WHERE user_id = ? AND trip_id = ?')
            .all(req.session.userId, req.query.trip_id);
        return rows.map((r) => ({
            draft_key: r.draft_key,
            data: JSON.parse(r.data),
            updated_at: r.updated_at,
        }));
    });
    app.put('/drafts', async (req, reply) => {
        const { trip_id, draft_key, data } = req.body ?? {};
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        if (!draft_key)
            return reply.code(400).send({ error: 'draft_key erforderlich' });
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO drafts (user_id, trip_id, draft_key, data, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, trip_id, draft_key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).run(req.session.userId, trip_id, draft_key, JSON.stringify(data ?? {}), now);
        return reply.send({ updated_at: now });
    });
    app.delete('/drafts', async (req, reply) => {
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        if (!req.query.draft_key)
            return reply.code(400).send({ error: 'draft_key erforderlich' });
        db.prepare('DELETE FROM drafts WHERE user_id = ? AND trip_id = ? AND draft_key = ?').run(req.session.userId, req.query.trip_id, req.query.draft_key);
        return reply.code(204).send();
    });
};
