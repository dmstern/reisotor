import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';

const TABLES = [
  'users',
  'trips',
  'trip_members',
  'schedule_items',
  'packing_items',
  'ideas',
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
  'diary_spots',
  'spots',
  'excursion_spots',
  'idea_likes',
  'idea_comments',
  'spot_likes',
  'spot_comments',
  'note_likes',
  'note_comments',
] as const;

// Tabellen mit eigener trip_id-Spalte – für den auf die eigenen Urlaube beschränkten Export
// direkt per trip_id filterbar (siehe scopedTables() unten).
const DIRECT_TRIP_SCOPED_TABLES = new Set([
  'trips',
  'trip_members',
  'schedule_items',
  'packing_items',
  'ideas',
  'budget_items',
  'budgets',
  'budget_transfers',
  'shopping_items',
  'todo_items',
  'notes',
  'diary_entries',
  'spots',
]);

// Tabellen ohne eigene trip_id – müssen über die jeweilige Elterntabelle gefiltert werden (siehe
// scopedTables() unten). budget_allocations hängt an budgets, die diary_*-Tabellen an
// diary_entries, die idea_*-Tabellen (inkl. excursion_spots) an ideas, die spot_*-Tabellen an
// spots, die note_*-Tabellen an notes.
const JOINED_TABLE_FILTERS: Record<string, string> = {
  budget_allocations: `budget_id IN (SELECT id FROM budgets WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  diary_likes: `entry_id IN (SELECT id FROM diary_entries WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  diary_comments: `entry_id IN (SELECT id FROM diary_entries WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  diary_excursions: `entry_id IN (SELECT id FROM diary_entries WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  diary_spots: `entry_id IN (SELECT id FROM diary_entries WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  excursion_spots: `idea_id IN (SELECT id FROM ideas WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  idea_likes: `idea_id IN (SELECT id FROM ideas WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  idea_comments: `idea_id IN (SELECT id FROM ideas WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  spot_likes: `spot_id IN (SELECT id FROM spots WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  spot_comments: `spot_id IN (SELECT id FROM spots WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  note_likes: `note_id IN (SELECT id FROM notes WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
  note_comments: `note_id IN (SELECT id FROM notes WHERE trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = ?))`,
};

type TableName = (typeof TABLES)[number];
type SqlRow = Record<string, string | number | null>;
type SqlValue = string | number | bigint | null | Buffer;

interface BackupPayload {
  version: number;
  exportedAt: string;
  data: Record<TableName, SqlRow[]>;
}

// trip_members ist nachträglich (Batch: Registrierung + Einladung) zu TABLES dazugekommen – ein
// Backup aus der Zeit davor hat dafür noch kein Array. Nicht Teil der Pflicht-Prüfung, damit
// bestehende Backup-Dateien der beiden echten Nutzer:innen weiterhin importierbar bleiben (siehe
// Fallback beim Import unten, der Mitgliedschaft in diesem Fall selbst rekonstruiert).
const REQUIRED_TABLES = TABLES.filter((t) => t !== 'trip_members');

function isValidPayload(body: unknown): body is BackupPayload {
  if (!body || typeof body !== 'object') return false;
  const data = (body as { data?: unknown }).data;
  if (!data || typeof data !== 'object') return false;
  return REQUIRED_TABLES.every((table) => Array.isArray((data as Record<string, unknown>)[table]));
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

  await Promise.all(data.schedule_items.map((row) => resolveRow(row, 'maps_link', 'lat', 'lng')));
}

// SQL-Fragment "gehört zu einem Urlaub, dessen Mitglied die anfragende Person ist" – als
// Unterabfrage in jede Tabellen-Filterung eingesetzt (siehe rowsForTable unten). Immer derselbe
// Platzhalter-Parameter (userId), egal welche Tabelle gerade gefiltert wird.
const MEMBER_TRIP_IDS_SUBQUERY = 'SELECT trip_id FROM trip_members WHERE user_id = ?';

/** Liefert nur die Zeilen einer Tabelle, die zu einem Urlaub der anfragenden Person gehören –
 *  seit Einführung des Mitgliedschaftskonzepts (Registrierung + Einladung) sonst ein Datenleck:
 *  ohne diese Einschränkung exportierte /backup/export fremde, private Urlaube gleich mit. */
function rowsForTable(table: TableName, userId: number): SqlRow[] {
  if (table === 'users') {
    return db
      .prepare(
        `SELECT DISTINCT users.* FROM users
         JOIN trip_members ON trip_members.user_id = users.id
         WHERE trip_members.trip_id IN (${MEMBER_TRIP_IDS_SUBQUERY})`,
      )
      .all(userId) as SqlRow[];
  }
  if (table === 'trips') {
    return db.prepare(`SELECT * FROM trips WHERE id IN (${MEMBER_TRIP_IDS_SUBQUERY})`).all(userId) as SqlRow[];
  }
  if (DIRECT_TRIP_SCOPED_TABLES.has(table)) {
    return db
      .prepare(`SELECT * FROM ${table} WHERE trip_id IN (${MEMBER_TRIP_IDS_SUBQUERY})`)
      .all(userId) as SqlRow[];
  }
  const filter = JOINED_TABLE_FILTERS[table];
  return db.prepare(`SELECT * FROM ${table} WHERE ${filter}`).all(userId) as SqlRow[];
}

import { isUserAdmin } from '../registrationConfig.js';

export const backupRoutes: FastifyPluginAsync = async (app) => {
  app.get('/backup/export', async (req, reply) => {
    if (!isUserAdmin(req.session.userId)) {
      return reply.code(403).send({ error: 'Nur Administrator:innen dürfen Datensicherungen durchführen.' });
    }
    const data = {} as BackupPayload['data'];
    for (const table of TABLES) {
      data[table] = rowsForTable(table, req.session.userId!);
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
    if (!isUserAdmin(req.session.userId)) {
      return reply.code(403).send({ error: 'Nur Administrator:innen dürfen Datensicherungen durchführen.' });
    }
    if (!isValidPayload(req.body)) {
      return reply.code(400).send({ error: 'Ungültige oder unvollständige Backup-Datei' });
    }
    const payload = req.body;

    // Sicherheitsnetz seit Einführung der Selbstregistrierung (Batch: Registrierung + Einladung):
    // ein Import überschreibt/löscht unten die komplette Datenbank – das war unproblematisch,
    // solange ohnehin alle Nutzer:innen Zugriff auf alle Urlaube hatten. Jetzt könnte sich sonst
    // eine frisch registrierte, fremde Person per Import Zugriff auf (und Löschung von) Urlaube
    // verschaffen, denen sie nie beigetreten ist. Import bleibt daher auf den Fall beschränkt, dass
    // die importierende Person bereits Mitglied JEDES aktuell vorhandenen Urlaubs ist – deckt den
    // ursprünglichen "wir teilen uns alles"-Anwendungsfall unverändert ab, ohne fremde Daten zu
    // gefährden.
    const allExistingTrips = db.prepare('SELECT id FROM trips').all() as { id: number }[];
    const memberTripIds = new Set(
      (
        db.prepare('SELECT trip_id FROM trip_members WHERE user_id = ?').all(req.session.userId) as {
          trip_id: number;
        }[]
      ).map((r) => r.trip_id),
    );
    if (!allExistingTrips.every((t) => memberTripIds.has(t.id))) {
      return reply.code(403).send({
        error:
          'Import nicht möglich: du bist nicht Mitglied aller aktuell vorhandenen Urlaube – ein Import würde deren Daten überschreiben.',
      });
    }

    // Ältere Backups (vor Einführung des Mitgliedschaftskonzepts) haben noch kein trip_members-
    // Array (siehe REQUIRED_TABLES oben) – rekonstruiert hier das ursprüngliche "alle Nutzer:innen
    // sehen alle Urlaube"-Verhalten, statt die importierten Urlaube ohne jedes Mitglied (und damit
    // für niemanden mehr sichtbar) zurückzulassen.
    if (!payload.data.trip_members?.length) {
      const users = payload.data.users ?? [];
      const trips = payload.data.trips ?? [];
      payload.data.trip_members = trips.flatMap((trip) =>
        users.map((user) => ({
          trip_id: trip.id as number,
          user_id: user.id as number,
          created_at: payload.exportedAt,
        })),
      );
    }

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
