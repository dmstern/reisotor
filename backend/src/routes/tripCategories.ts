import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

export interface TripCategoryRow {
  id: number;
  trip_id: number;
  type: string;
  name: string;
  icon: string | null;
  emoji: string | null;
  color: string | null;
  is_hidden: number;
  created_at: string;
  usage_count?: number;
}

interface CategoryBody {
  type: 'expense' | 'spot' | 'packing';
  name: string;
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
  is_hidden?: boolean | number;
}

/**
 * Registriert eine Kategorie automatisch für einen Urlaub, falls sie noch nicht existiert.
 * Wird beim Speichern von Ausgaben oder Spots mit benutzerdefinierten Kategorien aufgerufen.
 */
export function ensureTripCategory(
  tripId: number,
  type: 'expense' | 'spot' | 'packing',
  name: string,
  icon?: string | null,
  emoji?: string | null,
  color?: string | null
): void {
  const trimmed = name?.trim();
  if (!trimmed) return;

  const existing = db
    .prepare('SELECT id FROM trip_categories WHERE trip_id = ? AND type = ? AND name = ?')
    .get(tripId, type, trimmed);

  if (!existing) {
    db.prepare(
      `INSERT OR IGNORE INTO trip_categories (trip_id, type, name, icon, emoji, color, is_hidden)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(tripId, type, trimmed, icon ?? null, emoji ?? null, color ?? null);
  }
}

export const tripCategoriesRoutes: FastifyPluginAsync = async (app) => {
  // Alle Kategorien eines Urlaubs abrufen (inkl. usage_count und Erkennung von Freitext-Kategorien)
  app.get<{
    Params: { tripId: string };
    Querystring: { type?: string };
  }>('/trips/:tripId/categories', async (req, reply) => {
    const tripId = Number(req.params.tripId);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const filterType = req.query.type;

    // 1. Gespeicherte trip_categories abrufen
    let query = 'SELECT * FROM trip_categories WHERE trip_id = ?';
    const params: unknown[] = [tripId];
    if (filterType) {
      query += ' AND type = ?';
      params.push(filterType);
    }
    query += ' ORDER BY name COLLATE NOCASE ASC';

    const customCategories = db.prepare(query).all(...params) as TripCategoryRow[];

    // 2. Nutzungszahlen ermitteln
    const expenseUsageMap = new Map<string, number>();
    const spotUsageMap = new Map<string, number>();
    const packingUsageMap = new Map<string, number>();

    if (!filterType || filterType === 'expense') {
      const expenseItemRows = db
        .prepare(
          `SELECT category, COUNT(*) as cnt
           FROM budget_items
           WHERE trip_id = ? AND category IS NOT NULL AND TRIM(category) != ''
           GROUP BY category`
        )
        .all(tripId) as { category: string; cnt: number }[];
      for (const row of expenseItemRows) {
        expenseUsageMap.set(
          row.category.toLowerCase(),
          (expenseUsageMap.get(row.category.toLowerCase()) ?? 0) + row.cnt
        );
      }

      const allocationRows = db
        .prepare(
          `SELECT a.category, COUNT(*) as cnt
           FROM budget_allocations a
           JOIN budgets b ON b.id = a.budget_id
           WHERE b.trip_id = ? AND a.category IS NOT NULL AND TRIM(a.category) != ''
           GROUP BY a.category`
        )
        .all(tripId) as { category: string; cnt: number }[];
      for (const row of allocationRows) {
        expenseUsageMap.set(
          row.category.toLowerCase(),
          (expenseUsageMap.get(row.category.toLowerCase()) ?? 0) + row.cnt
        );
      }
    }

    if (!filterType || filterType === 'spot') {
      const spotRows = db
        .prepare(
          `SELECT category, COUNT(*) as cnt
           FROM spots
           WHERE trip_id = ? AND category IS NOT NULL AND TRIM(category) != ''
           GROUP BY category`
        )
        .all(tripId) as { category: string; cnt: number }[];
      for (const row of spotRows) {
        spotUsageMap.set(
          row.category.toLowerCase(),
          (spotUsageMap.get(row.category.toLowerCase()) ?? 0) + row.cnt
        );
      }
    }

    if (!filterType || filterType === 'packing') {
      const packingRows = db
        .prepare(
          `SELECT category, COUNT(*) as cnt
           FROM packing_items
           WHERE trip_id = ? AND category IS NOT NULL AND TRIM(category) != ''
           GROUP BY category`
        )
        .all(tripId) as { category: string; cnt: number }[];
      for (const row of packingRows) {
        packingUsageMap.set(
          row.category.toLowerCase(),
          (packingUsageMap.get(row.category.toLowerCase()) ?? 0) + row.cnt
        );
      }
    }

    // Nutzungszahlen an vorhandene customCategories heften
    const categoryKeySet = new Set<string>();
    for (const cat of customCategories) {
      categoryKeySet.add(`${cat.type}:${cat.name.toLowerCase()}`);
      if (cat.type === 'expense') {
        cat.usage_count = expenseUsageMap.get(cat.name.toLowerCase()) ?? 0;
      } else if (cat.type === 'spot') {
        cat.usage_count = spotUsageMap.get(cat.name.toLowerCase()) ?? 0;
      } else if (cat.type === 'packing') {
        cat.usage_count = packingUsageMap.get(cat.name.toLowerCase()) ?? 0;
      }
    }

    // 3. Freitext-Kategorien, die in Datensätzen vorkommen, aber noch nicht in trip_categories sind,
    // dynamisch ergänzen, damit Nutzer sie sofort bearbeiten/löschen können.
    const implicitCategories: TripCategoryRow[] = [];

    function checkImplicit(type: 'expense' | 'spot' | 'packing', map: Map<string, number>) {
      for (const [nameLower, count] of map.entries()) {
        const key = `${type}:${nameLower}`;
        if (!categoryKeySet.has(key)) {
          let originalName = nameLower;
          if (type === 'expense') {
            const found = db
              .prepare(
                'SELECT category FROM budget_items WHERE trip_id = ? AND LOWER(category) = ? LIMIT 1'
              )
              .get(tripId, nameLower) as { category: string } | undefined;
            if (found?.category) originalName = found.category;
          } else if (type === 'spot') {
            const found = db
              .prepare(
                'SELECT category FROM spots WHERE trip_id = ? AND LOWER(category) = ? LIMIT 1'
              )
              .get(tripId, nameLower) as { category: string } | undefined;
            if (found?.category) originalName = found.category;
          } else if (type === 'packing') {
            const found = db
              .prepare(
                'SELECT category FROM packing_items WHERE trip_id = ? AND LOWER(category) = ? LIMIT 1'
              )
              .get(tripId, nameLower) as { category: string } | undefined;
            if (found?.category) originalName = found.category;
          }

          const insertStmt = db.prepare(
            `INSERT OR IGNORE INTO trip_categories (trip_id, type, name, is_hidden)
             VALUES (?, ?, ?, 0)`
          );
          const res = insertStmt.run(tripId, type, originalName);
          const newId =
            (res.lastInsertRowid as number) ||
            (
              db
                .prepare(
                  'SELECT id FROM trip_categories WHERE trip_id = ? AND type = ? AND name = ?'
                )
                .get(tripId, type, originalName) as { id: number }
            )?.id;

          implicitCategories.push({
            id: newId,
            trip_id: tripId,
            type,
            name: originalName,
            icon: null,
            emoji: null,
            color: null,
            is_hidden: 0,
            created_at: new Date().toISOString(),
            usage_count: count,
          });
          categoryKeySet.add(key);
        }
      }
    }

    if (!filterType || filterType === 'expense') {
      checkImplicit('expense', expenseUsageMap);
    }
    if (!filterType || filterType === 'spot') {
      checkImplicit('spot', spotUsageMap);
    }
    if (!filterType || filterType === 'packing') {
      checkImplicit('packing', packingUsageMap);
    }

    const allCategories = [...customCategories, ...implicitCategories].sort((a, b) =>
      a.name.localeCompare(b.name, 'de')
    );

    return { categories: allCategories };
  });

  // Neue Kategorie anlegen
  app.post<{
    Params: { tripId: string };
    Body: CategoryBody;
  }>('/trips/:tripId/categories', async (req, reply) => {
    const tripId = Number(req.params.tripId);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const { type, name, icon, emoji, color } = req.body;
    const trimmed = name?.trim();
    if (!trimmed) {
      return reply.code(400).send({ error: 'Name ist erforderlich' });
    }
    if (!['expense', 'spot', 'packing'].includes(type)) {
      return reply.code(400).send({ error: 'Ungültiger Kategorie-Typ' });
    }

    const stmt = db.prepare(
      `INSERT INTO trip_categories (trip_id, type, name, icon, emoji, color, is_hidden)
       VALUES (?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(trip_id, type, name) DO UPDATE SET
         icon = excluded.icon,
         emoji = excluded.emoji,
         color = excluded.color,
         is_hidden = 0`
    );

    stmt.run(tripId, type, trimmed, icon ?? null, emoji ?? null, color ?? null);

    const category = db
      .prepare('SELECT * FROM trip_categories WHERE trip_id = ? AND type = ? AND name = ?')
      .get(tripId, type, trimmed) as TripCategoryRow;

    category.usage_count = 0;
    recordActivity(tripId, 'trip', category.id, 'create_category', req.session.userId);

    return category;
  });

  // Kategorie aktualisieren (inkl. Kaskadierung bei Namensänderung)
  app.put<{
    Params: { tripId: string; id: string };
    Body: Partial<CategoryBody>;
  }>('/trips/:tripId/categories/:id', async (req, reply) => {
    const tripId = Number(req.params.tripId);
    const categoryId = Number(req.params.id);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const existing = db
      .prepare('SELECT * FROM trip_categories WHERE id = ? AND trip_id = ?')
      .get(categoryId, tripId) as TripCategoryRow | undefined;

    if (!existing) {
      return reply.code(404).send({ error: 'Kategorie nicht gefunden' });
    }

    const { name, icon, emoji, color, is_hidden } = req.body;
    const newName = name !== undefined ? name.trim() : existing.name;

    if (!newName) {
      return reply.code(400).send({ error: 'Name darf nicht leer sein' });
    }

    const newIcon = icon !== undefined ? icon : existing.icon;
    const newEmoji = emoji !== undefined ? emoji : existing.emoji;
    const newColor = color !== undefined ? color : existing.color;
    const newHidden = is_hidden !== undefined ? (is_hidden ? 1 : 0) : existing.is_hidden;

    // Transaktion: Bei Umbenennung alle Vorkommen im Urlaub mit umbenennen
    const updateTransaction = db.transaction(() => {
      if (newName !== existing.name) {
        if (existing.type === 'expense') {
          db.prepare('UPDATE budget_items SET category = ? WHERE trip_id = ? AND category = ?').run(
            newName,
            tripId,
            existing.name
          );

          // Allokationen in Budgets dieses Urlaubs aktualisieren
          const budgets = db.prepare('SELECT id FROM budgets WHERE trip_id = ?').all(tripId) as {
            id: number;
          }[];
          for (const b of budgets) {
            const targetAlloc = db
              .prepare('SELECT * FROM budget_allocations WHERE budget_id = ? AND category = ?')
              .get(b.id, newName) as { id: number; amount: number } | undefined;
            const currentAlloc = db
              .prepare('SELECT * FROM budget_allocations WHERE budget_id = ? AND category = ?')
              .get(b.id, existing.name) as { id: number; amount: number } | undefined;

            if (currentAlloc) {
              if (targetAlloc) {
                // Verschmelzen
                db.prepare('UPDATE budget_allocations SET amount = amount + ? WHERE id = ?').run(
                  currentAlloc.amount,
                  targetAlloc.id
                );
                db.prepare('DELETE FROM budget_allocations WHERE id = ?').run(currentAlloc.id);
              } else {
                db.prepare('UPDATE budget_allocations SET category = ? WHERE id = ?').run(
                  newName,
                  currentAlloc.id
                );
              }
            }
          }
        } else if (existing.type === 'spot') {
          db.prepare('UPDATE spots SET category = ? WHERE trip_id = ? AND category = ?').run(
            newName,
            tripId,
            existing.name
          );
        } else if (existing.type === 'packing') {
          db.prepare(
            'UPDATE packing_items SET category = ? WHERE trip_id = ? AND category = ?'
          ).run(newName, tripId, existing.name);
        }
      }

      db.prepare(
        `UPDATE trip_categories
         SET name = ?, icon = ?, emoji = ?, color = ?, is_hidden = ?
         WHERE id = ?`
      ).run(newName, newIcon, newEmoji, newColor, newHidden, categoryId);
    });

    updateTransaction();

    const updated = db
      .prepare('SELECT * FROM trip_categories WHERE id = ?')
      .get(categoryId) as TripCategoryRow;

    recordActivity(tripId, 'trip', categoryId, 'update_category', req.session.userId);
    return updated;
  });

  // Kategorie löschen (inkl. Bereinigung verknüpfter Einträge)
  app.delete<{
    Params: { tripId: string; id: string };
  }>('/trips/:tripId/categories/:id', async (req, reply) => {
    const tripId = Number(req.params.tripId);
    const categoryId = Number(req.params.id);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const existing = db
      .prepare('SELECT * FROM trip_categories WHERE id = ? AND trip_id = ?')
      .get(categoryId, tripId) as TripCategoryRow | undefined;

    if (!existing) {
      return reply.code(404).send({ error: 'Kategorie nicht gefunden' });
    }

    const deleteTransaction = db.transaction(() => {
      // 1. Betroffene Datensätze von der Kategorie befreien (category = NULL)
      if (existing.type === 'expense') {
        db.prepare(
          'UPDATE budget_items SET category = NULL WHERE trip_id = ? AND category = ?'
        ).run(tripId, existing.name);

        db.prepare(
          `DELETE FROM budget_allocations
           WHERE category = ? AND budget_id IN (SELECT id FROM budgets WHERE trip_id = ?)`
        ).run(existing.name, tripId);
      } else if (existing.type === 'spot') {
        db.prepare('UPDATE spots SET category = NULL WHERE trip_id = ? AND category = ?').run(
          tripId,
          existing.name
        );
      } else if (existing.type === 'packing') {
        db.prepare(
          'UPDATE packing_items SET category = NULL WHERE trip_id = ? AND category = ?'
        ).run(tripId, existing.name);
      }

      // 2. Aus trip_categories entfernen
      db.prepare('DELETE FROM trip_categories WHERE id = ?').run(categoryId);
    });

    deleteTransaction();

    recordActivity(tripId, 'trip', categoryId, 'delete_category', req.session.userId);
    return { success: true };
  });

  // Standard-Kategorie ausblenden / einblenden
  app.post<{
    Params: { tripId: string };
    Body: { type: 'expense' | 'spot' | 'packing'; name: string; is_hidden: boolean };
  }>('/trips/:tripId/categories/hide', async (req, reply) => {
    const tripId = Number(req.params.tripId);
    if (!requireTripMember(reply, tripId, req.session.userId)) return;

    const { type, name, is_hidden } = req.body;
    const trimmed = name?.trim();
    if (!trimmed) {
      return reply.code(400).send({ error: 'Name ist erforderlich' });
    }

    const hiddenVal = is_hidden ? 1 : 0;
    db.prepare(
      `INSERT INTO trip_categories (trip_id, type, name, is_hidden)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(trip_id, type, name) DO UPDATE SET is_hidden = excluded.is_hidden`
    ).run(tripId, type, trimmed, hiddenVal);

    recordActivity(tripId, 'trip', null, 'hide_category', req.session.userId);
    return { success: true };
  });
};
