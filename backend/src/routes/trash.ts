import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';

// Konfiguration für den Papierkorb (weicher Löschvorgang, siehe db/index.ts's TRASH_TABLES):
// je Objekttyp Tabelle, deutsches Label (für die Papierkorb-Ansicht) und optional eine
// Restore-Kopplung für Zeilen, die beim Löschen des Haupt-Objekts mit "weggelöscht" wurden
// (siehe routes/ideas.ts/accommodation.ts/travel.ts) und beim Wiederherstellen ebenfalls
// zurückgeholt werden müssen.
interface TrashConfig {
  type: string;
  table: string;
  label: string;
  onRestore?: (id: string) => void;
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
  { type: 'spot', table: 'spots', label: 'Spot' },
  {
    type: 'accommodation',
    table: 'accommodation',
    label: 'Unterkunft',
    onRestore: (id) => restoreLinkedBudgetExpense('accommodation', id),
  },
  {
    type: 'travel_item',
    table: 'travel_items',
    label: 'Reise-Eintrag',
    onRestore: (id) => restoreLinkedBudgetExpense('travel_items', id),
  },
  { type: 'budget_item', table: 'budget_items', label: 'Bezahlung' },
  { type: 'budget_transfer', table: 'budget_transfers', label: 'Überweisung' },
  { type: 'todo', table: 'todo_items', label: 'ToDo' },
  { type: 'packing_item', table: 'packing_items', label: 'Packlisten-Eintrag' },
  { type: 'shopping_item', table: 'shopping_items', label: 'Einkaufslisten-Eintrag' },
  { type: 'note', table: 'notes', label: 'Notiz' },
  { type: 'diary_entry', table: 'diary_entries', label: 'Tagebuch-Eintrag' },
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
      const rows = db
        .prepare(`SELECT * FROM ${config.table} WHERE trip_id = ? AND deleted_at IS NOT NULL`)
        .all(req.query.trip_id) as Record<string, unknown>[];
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

    const result = db
      .prepare(`UPDATE ${config.table} SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`)
      .run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden oder nicht gelöscht' });

    config.onRestore?.(req.params.id);
    return db.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).get(req.params.id);
  });
};
