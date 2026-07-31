import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

// DB_PATH muss gesetzt sein, BEVOR src/app.ts (und damit src/db/index.ts) zum ersten Mal
// importiert wird - db ist ein Modul-Singleton, der beim Import die Schema-Erstellung anstößt.
// Dynamischer import() statt eines statischen Top-Level-Imports garantiert diese Reihenfolge
// explizit, statt sich auf Vitest-interne Ladereihenfolgen (setupFiles o.ä.) zu verlassen.
//
// Isolation ist pro Testdatei, nicht pro Test: Vitest gibt jeder Testdatei standardmäßig ein
// eigenes Modul-Registry (siehe vitest.config.ts, isolate:true) - der erste buildTestApp()-Aufruf
// einer Datei erzeugt dadurch automatisch eine frische :memory:-DB. Ein zweiter Aufruf `import
// '../../src/db/index.js'` in derselben Datei trifft auf denselben gecachten Modul-Singleton wie
// der, den app.ts intern verwendet (wichtig: NICHT per Query-String o.ä. künstlich "frisch"
// erzwingen - app.ts's eigener statischer `import './db/index.js'` würde davon unberührt bleiben
// und weiterhin die alte Instanz verwenden, wodurch Test-Seeds und Routen-Handler auf zwei
// unterschiedlichen DBs landen würden). Deshalb: einmal pro Datei in beforeAll aufrufen, App +
// db-Handle über alle it()-Blöcke der Datei wiederverwenden; jeder Test legt eigene, eindeutig
// identifizierbare Ressourcen an statt sich auf eine leere Tabelle zu verlassen.
export async function buildTestApp(): Promise<{ app: FastifyInstance; db: Database.Database }> {
  process.env.DB_PATH = ':memory:';
  process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars';
  process.env.UPLOADS_DIR = mkdtempSync(path.join(tmpdir(), 'reisotor-test-uploads-'));
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  delete process.env.NODE_ENV;

  const { buildApp } = await import('../../src/app.js');
  const { db } = await import('../../src/db/index.js');
  const app = await buildApp({ logger: false });
  return { app, db };
}
