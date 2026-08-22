import { db } from './db/index.js';
/** Sessions persistent (in der ohnehin vorhandenen SQLite-DB) statt nur im Arbeitsspeicher halten
 *  (@fastify/session-Default) – sonst verliert jeder Nutzer seinen Login bei jedem
 *  Prozess-Neustart (Crash, Deploy, OOM auf dem Raspberry Pi). Eigener, sehr einfacher Store statt
 *  einer zusätzlichen Abhängigkeit (z. B. connect-sqlite3), da better-sqlite3 schon verbunden ist –
 *  better-sqlite3 ist synchron, die Callbacks werden daher direkt aufgerufen. */
export class SqliteSessionStore {
    set(sessionId, session, callback) {
        try {
            const expires = session.cookie?.expires ? new Date(session.cookie.expires).getTime() : null;
            db.prepare(`INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
         ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`).run(sessionId, JSON.stringify(session), expires);
            callback();
        }
        catch (err) {
            callback(err);
        }
    }
    get(sessionId, callback) {
        try {
            const row = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?').get(sessionId);
            if (!row) {
                callback(null, null);
                return;
            }
            if (row.expires != null && row.expires < Date.now()) {
                db.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
                callback(null, null);
                return;
            }
            callback(null, JSON.parse(row.sess));
        }
        catch (err) {
            callback(err);
        }
    }
    destroy(sessionId, callback) {
        try {
            db.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
            callback();
        }
        catch (err) {
            callback(err);
        }
    }
}
