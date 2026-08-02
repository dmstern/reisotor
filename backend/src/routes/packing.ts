import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { requireTripMember } from '../tripAccess.js';
import { recordActivity } from '../activity.js';

interface PackingBody {
  trip_id: number;
  category?: string;
  subcategory?: string;
  label: string;
  quantity?: number;
  laid_out_count?: number;
  packed_count?: number;
  owner_id?: number | null;
}

/** Klammert beide Zähler serverseitig auf [0, quantity] und stellt sicher, dass "eingepackt" nie
 *  größer als "rausgelegt" ist (etwas Eingepacktes muss vorher rausgelegt worden sein) – schützt
 *  vor inkonsistenten Werten unabhängig davon, was das Frontend schickt. */
export function clampCounts(quantityRaw: number | undefined, laidOutRaw: number | undefined, packedRaw: number | undefined) {
  const quantity = Math.max(1, Math.round(quantityRaw ?? 1));
  const packed = Math.min(quantity, Math.max(0, Math.round(packedRaw ?? 0)));
  const laidOut = Math.min(quantity, Math.max(packed, Math.round(laidOutRaw ?? 0)));
  return { quantity, laidOut, packed };
}

export const packingRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/packing', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        'SELECT * FROM packing_items WHERE trip_id = ? AND deleted_at IS NULL ORDER BY category, subcategory, label',
      )
      .all(req.query.trip_id);
  });

  app.post<{ Body: PackingBody }>('/packing', async (req, reply) => {
    const { trip_id, category, subcategory, label, owner_id } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    const { quantity, laidOut, packed } = clampCounts(req.body.quantity, req.body.laid_out_count, req.body.packed_count);
    const result = db
      .prepare(
        `INSERT INTO packing_items (trip_id, category, subcategory, label, quantity, laid_out_count, packed_count, owner_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(trip_id, category ?? null, subcategory ?? null, label, quantity, laidOut, packed, owner_id ?? null);
    recordActivity(trip_id, 'packing', result.lastInsertRowid as number, 'created', req.session.userId!);
    reply.code(201);
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: PackingBody }>('/packing/:id', async (req, reply) => {
    const existingItem = db.prepare('SELECT trip_id FROM packing_items WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const { category, subcategory, label, owner_id } = req.body;
    const { quantity, laidOut, packed } = clampCounts(req.body.quantity, req.body.laid_out_count, req.body.packed_count);
    const result = db
      .prepare(
        `UPDATE packing_items
         SET category = ?, subcategory = ?, label = ?, quantity = ?, laid_out_count = ?, packed_count = ?, owner_id = ?
         WHERE id = ?`,
      )
      .run(category ?? null, subcategory ?? null, label, quantity, laidOut, packed, owner_id ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(existingItem.trip_id, 'packing', Number(req.params.id), 'updated', req.session.userId!);
    return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(req.params.id);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen.
  app.delete<{ Params: { id: string } }>('/packing/:id', async (req, reply) => {
    const existingItem = db.prepare('SELECT trip_id FROM packing_items WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existingItem) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existingItem.trip_id, req.session.userId)) return;

    const result = db
      .prepare('UPDATE packing_items SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    recordActivity(existingItem.trip_id, 'packing', Number(req.params.id), 'deleted', req.session.userId!);
    return reply.code(204).send();
  });
};
