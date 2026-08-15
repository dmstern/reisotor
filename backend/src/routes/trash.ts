import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

// Zuordnung des Papierkorb-Typs (TRASH_CONFIG unten) zur Nav-Item-Domäne für Echtzeit-Sync/
// Nav-Badges (stores/liveSync.ts im Frontend) – Wiederherstellen soll dieselbe Domäne "aufleuchten"
// lassen, in der das Objekt ursprünglich lebt, nicht einen generischen "trash"-Punkt.
const DOMAIN_BY_TYPE: Record<string, string> = {
  schedule_item: 'schedule',
  excursion: 'ideas',
  spot: 'spots',
  travel_item: 'travel',
  budget_item: 'budget',
  budget_transfer: 'budget',
  todo: 'todos',
  packing_item: 'packing',
  shopping_item: 'shopping',
  note: 'notes',
  diary_entry: 'diary',
  location_track: 'ideas',
};

// Konfiguration für den Papierkorb (weicher Löschvorgang, siehe db/index.ts's TRASH_TABLES):
// je Objekttyp Tabelle, deutsches Label (für die Papierkorb-Ansicht) und optional eine
// Restore-Kopplung für Zeilen, die beim Löschen des Haupt-Objekts mit "weggelöscht" wurden
// (siehe routes/ideas.ts/spots.ts/travel.ts) und beim Wiederherstellen ebenfalls
// zurückgeholt werden müssen.
interface TrashConfig {
  type: string;
  table: string;
  label: string;
  onRestore?: (id: string) => void;
  // Überschreibt die generische "SELECT * FROM table"-Listen-Query, falls ein Typ mehr als reine
  // Trip-Mitgliedschaft prüfen muss (siehe budget_item unten: private Budget-Töpfe dürfen nicht über
  // den Papierkorb an andere Mitglieder durchsickern).
  listQuery?: (tripId: string, userId: number | undefined) => Record<string, unknown>[];
  // Zusätzlicher Sichtbarkeits-Check vor dem Wiederherstellen (analog zu listQuery).
  checkVisible?: (id: string, userId: number | undefined) => boolean;
}

// Private Standort-Aufzeichnungen (visibility='private', Standard beim Start, siehe routes/tracks.ts)
// dürfen auch gelöscht nicht über den Papierkorb an andere Mitglieder durchsickern - gleiches
// Prinzip wie private Budget-Töpfe unten.
function isTrackVisible(id: string, userId: number | undefined): boolean {
  const row = db.prepare('SELECT user_id, visibility FROM location_tracks WHERE id = ?').get(id) as
    | { user_id: number; visibility: string }
    | undefined;
  if (!row) return true; // nicht gefunden - lässt den 404-Pfad des Aufrufers greifen
  return row.user_id === userId || row.visibility === 'shared';
}

function isBudgetItemVisible(id: string, userId: number | undefined): boolean {
  const row = db
    .prepare(
      `SELECT bi.budget_id, b.owner_id FROM budget_items bi
       LEFT JOIN budgets b ON b.id = bi.budget_id
       WHERE bi.id = ?`,
    )
    .get(id) as { budget_id: number | null; owner_id: number | null } | undefined;
  if (!row) return true; // nicht gefunden - lässt den 404-Pfad des Aufrufers greifen
  return row.budget_id == null || row.owner_id == null || row.owner_id === userId;
}

const TRASH_CONFIG: TrashConfig[] = [
  { type: 'schedule_item', table: 'schedule_items', label: 'Kalender-Termin' },
  {
    type: 'excursion',
    table: 'ideas',
    label: 'Ausflug',
    // Der Kalender-Termin, der den Ausflug als "geplant" markiert, wurde beim Löschen mit
    // weggelöscht (routes/ideas.ts) – ohne diese Kopplung bliebe er dauerhaft im Papierkorb,
    // obwohl der Ausflug selbst schon wiederhergestellt ist.
    onRestore: (id) =>
      db.prepare('UPDATE schedule_items SET deleted_at = NULL WHERE idea_id = ? AND deleted_at IS NOT NULL').run(id),
  },
  {
    type: 'spot',
    table: 'spots',
    label: 'Spot',
    // Betrifft nur Spots der Kategorie "Unterkunft" (budget_expense_id gesetzt, siehe
    // Migrationskommentar in db/index.ts) – bei gewöhnlichen Spots ist die Spalte leer, restoreLinkedBudgetExpense() ist dann ein No-Op.
    onRestore: (id) => restoreLinkedBudgetExpense('spots', id),
  },
  {
    type: 'travel_item',
    table: 'travel_items',
    label: 'Reise-Eintrag',
    onRestore: (id) => restoreLinkedBudgetExpense('travel_items', id),
  },
  {
    type: 'budget_item',
    table: 'budget_items',
    label: 'Bezahlung',
    // Ausgaben aus einem fremden privaten Budget-Topf dürfen auch gelöscht nicht über den
    // Papierkorb an andere Mitglieder durchsickern (gleiche Regel wie bei GET /budget).
    listQuery: (tripId, userId) =>
      db
        .prepare(
          `SELECT bi.* FROM budget_items bi
           LEFT JOIN budgets b ON b.id = bi.budget_id
           WHERE bi.trip_id = ? AND bi.deleted_at IS NOT NULL
             AND (bi.budget_id IS NULL OR b.owner_id IS NULL OR b.owner_id = ?)`,
        )
        .all(tripId, userId ?? null) as Record<string, unknown>[],
    checkVisible: isBudgetItemVisible,
  },
  { type: 'budget_transfer', table: 'budget_transfers', label: 'Überweisung' },
  { type: 'todo', table: 'todo_items', label: 'ToDo' },
  { type: 'packing_item', table: 'packing_items', label: 'Packlisten-Eintrag' },
  { type: 'shopping_item', table: 'shopping_items', label: 'Einkaufslisten-Eintrag' },
  { type: 'note', table: 'notes', label: 'Notiz' },
  { type: 'diary_entry', table: 'diary_entries', label: 'Tagebuch-Eintrag' },
  {
    type: 'location_track',
    table: 'location_tracks',
    label: 'Standort-Aufzeichnung',
    // Private Aufzeichnungen anderer Mitglieder dürfen weder gelistet noch wiederhergestellt
    // sichtbar sein (gleiches Muster wie bei budget_item oben).
    listQuery: (tripId, userId) =>
      db
        .prepare(
          `SELECT * FROM location_tracks
           WHERE trip_id = ? AND deleted_at IS NOT NULL AND (user_id = ? OR visibility = 'shared')`,
        )
        .all(tripId, userId ?? null) as Record<string, unknown>[],
    checkVisible: isTrackVisible,
  },
];

function restoreLinkedBudgetExpense(table: string, id: string) {
  const row = db.prepare(`SELECT budget_expense_id FROM ${table} WHERE id = ?`).get(id) as
    | { budget_expense_id: number | null }
    | undefined;
  if (row?.budget_expense_id) {
    db.prepare('UPDATE budget_items SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL').run(
      row.budget_expense_id,
    );
  }
}

export const trashRoutes: FastifyPluginAsync = async (app) => {
  // Listet alle weich gelöschten Objekte eines Urlaubs über alle Objekttypen hinweg, neueste
  // Löschung zuerst. `data` trägt die komplette Zeile (statt eines vorformatierten Titels) – die
  // Papierkorb-Ansicht im Frontend kennt pro Typ bereits die passenden Icons/Formatierungen
  // (spotCategoryMeta, scheduleCategory, …) und formatiert damit selbst.
  app.get<{ Querystring: { trip_id?: string } }>('/trash', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    const entries = TRASH_CONFIG.flatMap((config) => {
      const rows = config.listQuery
        ? config.listQuery(req.query.trip_id as string, req.session.userId)
        : (db
            .prepare(`SELECT * FROM ${config.table} WHERE trip_id = ? AND deleted_at IS NOT NULL`)
            .all(req.query.trip_id) as Record<string, unknown>[]);
      return rows.map((row) => ({
        type: config.type,
        id: row.id as number,
        label: config.label,
        deletedAt: row.deleted_at as string,
        data: row,
      }));
    });
    entries.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    return entries;
  });

  app.post<{ Params: { type: string; id: string } }>('/trash/:type/:id/restore', async (req, reply) => {
    const config = TRASH_CONFIG.find((c) => c.type === req.params.type);
    if (!config) return reply.code(400).send({ error: 'Unbekannter Objekttyp' });

    const existingRow = db.prepare(`SELECT trip_id FROM ${config.table} WHERE id = ?`).get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingRow) return reply.code(404).send({ error: 'Nicht gefunden oder nicht gelöscht' });
    if (!requireTripMember(reply, existingRow.trip_id, req.session.userId)) return;
    if (config.checkVisible && !config.checkVisible(req.params.id, req.session.userId)) {
      return reply.code(403).send({ error: 'Kein Zugriff auf dieses Objekt' });
    }

    const result = db
      .prepare(`UPDATE ${config.table} SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`)
      .run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden oder nicht gelöscht' });

    config.onRestore?.(req.params.id);
    recordActivity(
      existingRow.trip_id,
      DOMAIN_BY_TYPE[req.params.type] ?? req.params.type,
      Number(req.params.id),
      'restored',
      req.session.userId!,
    );
    return db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(req.params.id);
  });
};
