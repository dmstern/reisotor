import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';

const TABLES = [
  'users',
  'trips',
  'schedule_items',
  'packing_items',
  'ideas',
  'accommodation',
  'budget_items',
  'budgets',
  'budget_allocations',
  'budget_transfers',
  'shopping_items',
  'todo_items',
  'notes',
  'diary_entries',
  'diary_likes',
  'diary_comments',
  'diary_excursions',
  'travel_items',
  'spots',
  'excursion_spots',
  'idea_likes',
  'idea_comments',
  'spot_likes',
  'spot_comments',
  'note_likes',
  'note_comments',
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

/** Löst Google/Apple-Maps-Kurzlinks für importierte Zeilen auf, die zwar einen maps_link, aber
 *  (noch) keine Koordinaten haben – z. B. ein Backup aus einer älteren App-Version, in der die
 *  Auflösung noch nicht existierte, oder eines, das (wie beim regulären Anlegen über die API)
 *  ohne bereits aufgelöste Koordinaten exportiert wurde. Läuft VOR der eigentlichen (synchronen)
 *  Import-Transaktion, da resolveLatLng Netzwerkzugriffe macht. Zeilen ohne maps_link oder mit
 *  bereits gesetzten Koordinaten bleiben unangetastet. */
async function resolveMissingCoordinates(data: BackupPayload['data']) {
  async function resolveRow(row: SqlRow, linkKey: string, latKey: string, lngKey: string) {
    const link = row[linkKey];
    if (typeof link !== 'string' || !link) return;
    if (row[latKey] != null && row[lngKey] != null) return;
    const resolved = await resolveLatLng(link);
    row[latKey] = resolved?.lat ?? null;
    row[lngKey] = resolved?.lng ?? null;
  }

  await Promise.all(data.spots.map((row) => resolveRow(row, 'maps_link', 'lat', 'lng')));
  // Wie beim regulären Anlegen (routes/spots.ts): kein eigenes Bild, aber jetzt bekannter
  // Standort -> automatisches Kartenausschnitt-Vorschaubild statt leerem Platzhalter.
  for (const row of data.spots) {
    if (!row.image_url && row.lat != null && row.lng != null) {
      row.image_url = tilePreviewUrl(row.lat as number, row.lng as number);
    }
  }

  await Promise.all(data.accommodation.map((row) => resolveRow(row, 'maps_link', 'lat', 'lng')));
  await Promise.all(data.schedule_items.map((row) => resolveRow(row, 'maps_link', 'lat', 'lng')));
  await Promise.all(
    data.travel_items.map(async (row) => {
      await resolveRow(row, 'from_maps_link', 'from_lat', 'from_lng');
      await resolveRow(row, 'to_maps_link', 'to_lat', 'to_lng');
    }),
  );
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
    await resolveMissingCoordinates(payload.data);

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
