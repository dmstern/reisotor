import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { DOMAIN_LABEL, ACTION_LABEL } from '../push.js';
const MAX_NOTIFICATIONS = 50;
function toNotification(row) {
    return {
        id: row.id,
        trip_id: row.trip_id,
        domain: row.domain,
        entity_id: row.entity_id,
        action: row.action,
        created_at: row.created_at,
        actor: { id: row.actor_user_id, username: row.actor_username, avatar: row.actor_avatar },
        domain_label: DOMAIN_LABEL[row.domain] ?? row.domain,
        action_label: ACTION_LABEL[row.action] ?? 'etwas geändert',
        read: !!row.read,
    };
}
// Notification-Inbox (#97): Wiederverwendung des bereits bestehenden trip_activity-Logs (siehe
// activity.ts) statt eines eigenen, parallelen Ereignis-Systems - der einzige neue Zustand ist, WER
// welchen Log-Eintrag schon gelesen hat (notification_reads, siehe db/index.ts). Bewusst pro Urlaub
// wie der Rest des Headers (TripSwitcher/PresenceAvatars) statt urlaubsübergreifend über alle
// Mitgliedschaften - konsistent mit dem sonst durchgängig trip-zentrierten Header.
export const notificationsRoutes = async (app) => {
    app.get('/notifications', async (req, reply) => {
        if (!requireTripMember(reply, req.query.trip_id, req.session.userId))
            return;
        const rows = db
            .prepare(`SELECT trip_activity.*, users.username AS actor_username, users.avatar AS actor_avatar,
                CASE WHEN notification_reads.user_id IS NULL THEN 0 ELSE 1 END AS read
         FROM trip_activity
         JOIN users ON users.id = trip_activity.actor_user_id
         LEFT JOIN notification_reads
           ON notification_reads.activity_id = trip_activity.id AND notification_reads.user_id = ?
         WHERE trip_activity.trip_id = ? AND trip_activity.actor_user_id != ?
         ORDER BY trip_activity.created_at DESC
         LIMIT ?`)
            .all(req.session.userId, req.query.trip_id, req.session.userId, MAX_NOTIFICATIONS);
        return rows.map(toNotification);
    });
    app.post('/notifications/:id/read', async (req, reply) => {
        const activity = db.prepare('SELECT trip_id FROM trip_activity WHERE id = ?').get(req.params.id);
        if (!activity)
            return reply.code(404).send({ error: 'Nicht gefunden' });
        if (!requireTripMember(reply, activity.trip_id, req.session.userId))
            return;
        db.prepare(`INSERT INTO notification_reads (user_id, activity_id, read_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id, activity_id) DO NOTHING`).run(req.session.userId, req.params.id, new Date().toISOString());
        return reply.code(204).send();
    });
    app.post('/notifications/read-all', async (req, reply) => {
        const { trip_id } = req.body ?? {};
        if (!requireTripMember(reply, trip_id, req.session.userId))
            return;
        const now = new Date().toISOString();
        db.prepare(`INSERT INTO notification_reads (user_id, activity_id, read_at)
       SELECT ?, trip_activity.id, ?
       FROM trip_activity
       WHERE trip_activity.trip_id = ? AND trip_activity.actor_user_id != ?
       ON CONFLICT(user_id, activity_id) DO NOTHING`).run(req.session.userId, now, trip_id, req.session.userId);
        return reply.code(204).send();
    });
};
