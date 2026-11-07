import type { Session } from 'fastify';
import type { SessionStore } from '@fastify/session';
import { db } from './db/index.js';

type Callback = (err?: unknown) => void;
type CallbackSession = (err: unknown, result?: Session | null) => void;

interface SessionRow {
  sess: string;
  expires: number | null;
}

function createSessionMissingError(): Error & { code: string } {
  const error = new Error('The session does not exist or has changed') as Error & {
    code: string;
  };
  error.code = 'ENOENT';
  return error;
}

function upsertSession(sessionId: string, session: Session) {
  const expires = session.cookie?.expires ? new Date(session.cookie.expires).getTime() : null;
  db.prepare(
    `INSERT INTO sessions (sid, sess, expires) VALUES (?, ?, ?)
     ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires = excluded.expires`
  ).run(sessionId, JSON.stringify(session), expires);
}

/** Sessions persistent (in der ohnehin vorhandenen SQLite-DB) statt nur im Arbeitsspeicher halten
 *  (@fastify/session-Default) – sonst verliert jeder Nutzer seinen Login bei jedem
 *  Prozess-Neustart (Crash, Deploy, OOM auf dem Raspberry Pi). Eigener, sehr einfacher Store statt
 *  einer zusätzlichen Abhängigkeit (z. B. connect-sqlite3), da better-sqlite3 schon verbunden ist –
 *  better-sqlite3 ist synchron, die Callbacks werden daher direkt aufgerufen. */
export class SqliteSessionStore implements SessionStore {
  set(sessionId: string, session: Session, callback: Callback) {
    try {
      upsertSession(sessionId, session);
      callback();
    } catch (err) {
      callback(err);
    }
  }

  get(sessionId: string, callback: CallbackSession) {
    try {
      const row = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?').get(sessionId) as
        SessionRow | undefined;
      if (!row) {
        callback(null, null);
        return;
      }
      if (row.expires != null && row.expires <= Date.now()) {
        db.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  compareAndSet(
    sessionId: string,
    expectedGeneration: string,
    session: Session,
    callback: Callback
  ) {
    try {
      const row = db.prepare('SELECT sess, expires FROM sessions WHERE sid = ?').get(sessionId) as
        SessionRow | undefined;
      if (!row) {
        callback(createSessionMissingError());
        return;
      }
      const storedSession = JSON.parse(row.sess) as Session & {
        __fastifySessionMetadata?: { generation?: string };
      };
      const actualGeneration = storedSession?.__fastifySessionMetadata?.generation ?? sessionId;
      if (actualGeneration !== expectedGeneration) {
        callback(createSessionMissingError());
        return;
      }

      upsertSession(sessionId, session);
      callback();
    } catch (err) {
      callback(err);
    }
  }

  destroy(sessionId: string, callback: Callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
      callback();
    } catch (err) {
      callback(err);
    }
  }
}
