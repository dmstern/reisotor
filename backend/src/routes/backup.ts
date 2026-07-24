import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

const TABLES = [
  'users',
  'trip',
  'schedule_items',
  'packing_items',
  'ideas',
  'spots',
  'accommodation',
  'budget_items',
  'budget_targets',
  'budget_category_targets',
  'budget_transfers',
  'shopping_items',
  'notes',
  'diary_entries',
  'diary_likes',
  'diary_comments',
  'travel_items',
] as const;

type TableName = (typeof TABLES)[number];
type SqlRow = Record<string, string | number | null>;
type SqlValue = string | number | bigint | null | Buffer;

interface BackupPayload {
  version: number;
  exportedAt: string;
  data: Record<TableName, SqlRow[]>;
}

function isValidPayload(body: unknown): body is BackupPayload {
  if (!body || typeof body !== 'object') return false;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return false;
  return TABLES.every((table) => Array.isArray((data as Record<string, unknown>)[table]));
}

export const backupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/backup/export', async (_req, reply) => {
    const data = {} as BackupPayload['data'];
    for (const table of TABLES) {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all() as SqlRow[];
    }

    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    const filename = `reisotor-backup-${new Date().toISOString().slice(0, 10)}.json`;
    reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(JSON.stringify(payload, null, 2));
  });

  app.post('/backup/import', async (req, reply) => {
    if (!isValidPayload(req.body)) {
      return reply.code(400).send({ error: 'Ungültige oder unvollständige Backup-Datei' });
    }
    const payload = req.body;

    const counts: Record<string, number> = {};

    db.pragma('foreign_keys = OFF');
    try {
      const runImport = db.transaction(() => {
        for (const table of TABLES) {
          db.prepare(`DELETE FROM ${table}`).run();
        }

        for (const table of TABLES) {
          const rows = payload.data[table];
          counts[table] = rows.length;
          if (rows.length === 0) continue;

          const columns = Object.keys(rows[0]);
          const placeholders = columns.map(() => '?').join(', ');
          const insert = db.prepare(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          );
          for (const row of rows) {
            insert.run(...columns.map((c) => row[c] as SqlValue));
          }
        }
      });

      runImport();
    } catch (err) {
      req.log.error(err);
      return reply.code(400).send({
        error: 'Import fehlgeschlagen – Backup passt nicht zum aktuellen Datenmodell. Es wurde nichts verändert.',
      });
    } finally {
      db.pragma('foreign_keys = ON');
    }

    return { imported: counts };
  });
};
