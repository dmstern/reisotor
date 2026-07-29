import type { FastifyPluginAsync } from 'fastify';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { resolveLatLng } from '../utils/mapsLink.js';

interface TravelBody {
  trip_id: number;
  title: string;
  type?: string;
  from_location?: string;
  to_location?: string;
  date?: string;
  departure_time?: string;
  arrival_time?: string;
  checkin_info?: string;
  amount?: number;
  paid_by_user_id?: number | null;
  luggage?: string;
  seat?: string;
  link?: string;
  note?: string;
  from_maps_link?: string;
  from_lat?: number;
  from_lng?: number;
  to_maps_link?: string;
  to_lat?: number;
  to_lng?: number;
  role?: 'arrival' | 'departure' | 'onward';
  from_place_id?: number | null;
  to_place_id?: number | null;
}

interface TravelRow {
  id: number;
  trip_id: number;
  title: string;
  amount: number | null;
  paid_by_user_id: number | null;
  date: string | null;
  budget_expense_id: number | null;
}

interface TravelPlaceBody {
  trip_id: number;
  name: string;
  is_home?: boolean;
  maps_link?: string;
  lat?: number;
  lng?: number;
}

interface TravelPlaceRow {
  id: number;
  name: string;
  is_home: 0 | 1;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
}

/** Bestimmt, wie die verknüpfte Budget-Ausgabe aussehen soll, ohne bereits zu löschen –
 *  eine ggf. verwaiste alte Ausgabe wird erst gelöscht, NACHDEM die travel_items-Zeile
 *  nicht mehr per Foreign Key darauf verweist (sonst SQLITE_CONSTRAINT_FOREIGNKEY).
 *
 *  Bugfix (Batch 11): Die Ausgabe wird jetzt fest mit `budget_id` an das geteilte Budget des
 *  Urlaubs gebunden, statt (wie zuvor) ohne budget_id nur über den zufällig gleichen
 *  Kategorienamen in der Kategorien-Visualisierung "erraten" zu werden – das brach z. B. sobald
 *  ein zweites geteiltes Budget oder eine umbenannte Kategorie existierte. */
function planBudgetExpense(tripId: number, existingBudgetExpenseId: number | null, body: TravelBody) {
  const hasAmount = body.amount != null && body.amount > 0 && body.paid_by_user_id != null;

  if (!hasAmount) {
    return { budgetExpenseId: null as number | null, staleIdToDelete: existingBudgetExpenseId };
  }

  const sharedBudgetId = ensureDefaultSharedBudget(tripId);

  if (existingBudgetExpenseId) {
    db.prepare(
      'UPDATE budget_items SET title = ?, category = ?, amount = ?, paid_by_user_id = ?, date = ?, budget_id = ? WHERE id = ?',
    ).run(
      body.title,
      'Transport',
      body.amount,
      body.paid_by_user_id,
      body.date ?? null,
      sharedBudgetId,
      existingBudgetExpenseId,
    );
    return { budgetExpenseId: existingBudgetExpenseId, staleIdToDelete: null };
  }

  const result = db
    .prepare(
      `INSERT INTO budget_items (trip_id, title, category, amount, paid_by_user_id, date, note, budget_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      tripId,
      body.title,
      'Transport',
      body.amount,
      body.paid_by_user_id,
      body.date ?? null,
      'Automatisch aus Reise-Eintrag',
      sharedBudgetId,
    );
  return { budgetExpenseId: result.lastInsertRowid as number, staleIdToDelete: null };
}

async function resolveFromToLatLng(body: TravelBody) {
  if ((body.from_lat == null || body.from_lng == null) && body.from_maps_link) {
    const resolved = await resolveLatLng(body.from_maps_link);
    body.from_lat = resolved?.lat;
    body.from_lng = resolved?.lng;
  }
  if ((body.to_lat == null || body.to_lng == null) && body.to_maps_link) {
    const resolved = await resolveLatLng(body.to_maps_link);
    body.to_lat = resolved?.lat;
    body.to_lng = resolved?.lng;
  }
}

/** Übernimmt bei gesetztem from_place_id/to_place_id die Orts-Stammdaten in die schon bestehenden
 *  "flachen" from_location/from_maps_link/... -Felder (bzw. die "to_"-Pendants), die alle
 *  bestehenden Verbraucher (Karte, Kalender, Detail-Dialog) bereits kennen – der Ort ist damit nur
 *  eine bequeme, wiederverwendbare Eingabequelle, kein neuer Datenpfad, den andere Stellen der App
 *  zusätzlich verstehen müssten. Leitet außerdem, sofern keine Rolle explizit gesetzt wurde, aus
 *  is_home beider Orte eine sinnvolle Standard-Rolle ab (Anreise/Abreise/Weiterreise) statt sie bei
 *  jeder Etappe manuell abfragen zu müssen.
 */
function applyPlaces(body: TravelBody) {
  const fromPlace = body.from_place_id
    ? (db.prepare('SELECT * FROM travel_places WHERE id = ?').get(body.from_place_id) as TravelPlaceRow | undefined)
    : undefined;
  const toPlace = body.to_place_id
    ? (db.prepare('SELECT * FROM travel_places WHERE id = ?').get(body.to_place_id) as TravelPlaceRow | undefined)
    : undefined;

  if (fromPlace) {
    body.from_location = fromPlace.name;
    body.from_maps_link = fromPlace.maps_link ?? undefined;
    body.from_lat = fromPlace.lat ?? undefined;
    body.from_lng = fromPlace.lng ?? undefined;
  }
  if (toPlace) {
    body.to_location = toPlace.name;
    body.to_maps_link = toPlace.maps_link ?? undefined;
    body.to_lat = toPlace.lat ?? undefined;
    body.to_lng = toPlace.lng ?? undefined;
  }

  if (!body.role && fromPlace && toPlace) {
    if (fromPlace.is_home && !toPlace.is_home) body.role = 'arrival';
    else if (!fromPlace.is_home && toPlace.is_home) body.role = 'departure';
    else body.role = 'onward';
  }
}

export const travelRoutes: FastifyPluginAsync = async (app) => {
  // --- Orte (Batch: Reise/Flüge schlauer machen) ---

  app.get<{ Querystring: { trip_id?: string } }>('/travel/places', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare('SELECT * FROM travel_places WHERE trip_id = ? ORDER BY is_home DESC, name COLLATE NOCASE')
      .all(req.query.trip_id);
  });

  app.post<{ Body: TravelPlaceBody }>('/travel/places', async (req, reply) => {
    const { trip_id, name, is_home } = req.body;
    let { lat, lng } = req.body;
    const { maps_link } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    const result = db
      .prepare('INSERT INTO travel_places (trip_id, name, is_home, maps_link, lat, lng) VALUES (?, ?, ?, ?, ?, ?)')
      .run(trip_id, name, is_home ? 1 : 0, maps_link ?? null, lat ?? null, lng ?? null);
    reply.code(201);
    return db.prepare('SELECT * FROM travel_places WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TravelPlaceBody }>('/travel/places/:id', async (req, reply) => {
    const { name, is_home } = req.body;
    let { lat, lng } = req.body;
    const { maps_link } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    const result = db
      .prepare('UPDATE travel_places SET name = ?, is_home = ?, maps_link = ?, lat = ?, lng = ? WHERE id = ?')
      .run(name, is_home ? 1 : 0, maps_link ?? null, lat ?? null, lng ?? null, req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM travel_places WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/travel/places/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM travel_places WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Etappen ---

  app.get<{ Querystring: { trip_id?: string } }>('/travel', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM travel_items WHERE trip_id = ? ORDER BY date, id').all(req.query.trip_id);
  });

  app.post<{ Body: TravelBody }>('/travel', async (req, reply) => {
    const body = req.body;
    applyPlaces(body);
    await resolveFromToLatLng(body);
    const { budgetExpenseId } = planBudgetExpense(body.trip_id, null, body);

    const result = db
      .prepare(
        `INSERT INTO travel_items
          (trip_id, title, type, from_location, to_location, date, departure_time, arrival_time, checkin_info, amount,
           paid_by_user_id, luggage, seat, link, note, budget_expense_id,
           from_maps_link, from_lat, from_lng, to_maps_link, to_lat, to_lng, role, from_place_id, to_place_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        body.trip_id,
        body.title,
        body.type ?? null,
        body.from_location ?? null,
        body.to_location ?? null,
        body.date ?? null,
        body.departure_time ?? null,
        body.arrival_time ?? null,
        body.checkin_info ?? null,
        body.amount ?? null,
        body.paid_by_user_id ?? null,
        body.luggage ?? null,
        body.seat ?? null,
        body.link ?? null,
        body.note ?? null,
        budgetExpenseId,
        body.from_maps_link ?? null,
        body.from_lat ?? null,
        body.from_lng ?? null,
        body.to_maps_link ?? null,
        body.to_lat ?? null,
        body.to_lng ?? null,
        body.role ?? null,
        body.from_place_id ?? null,
        body.to_place_id ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM travel_items WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: TravelBody }>('/travel/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id) as
      | TravelRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    const body = req.body;
    applyPlaces(body);
    await resolveFromToLatLng(body);
    const { budgetExpenseId, staleIdToDelete } = planBudgetExpense(existing.trip_id, existing.budget_expense_id, body);

    db.prepare(
      `UPDATE travel_items SET title = ?, type = ?, from_location = ?, to_location = ?, date = ?,
         departure_time = ?, arrival_time = ?, checkin_info = ?, amount = ?, paid_by_user_id = ?, luggage = ?, seat = ?,
         link = ?, note = ?, budget_expense_id = ?,
         from_maps_link = ?, from_lat = ?, from_lng = ?, to_maps_link = ?, to_lat = ?, to_lng = ?, role = ?,
         from_place_id = ?, to_place_id = ?
       WHERE id = ?`,
    ).run(
      body.title,
      body.type ?? null,
      body.from_location ?? null,
      body.to_location ?? null,
      body.date ?? null,
      body.departure_time ?? null,
      body.arrival_time ?? null,
      body.checkin_info ?? null,
      body.amount ?? null,
      body.paid_by_user_id ?? null,
      body.luggage ?? null,
      body.seat ?? null,
      body.link ?? null,
      body.note ?? null,
      budgetExpenseId,
      body.from_maps_link ?? null,
      body.from_lat ?? null,
      body.from_lng ?? null,
      body.to_maps_link ?? null,
      body.to_lat ?? null,
      body.to_lng ?? null,
      body.role ?? null,
      body.from_place_id ?? null,
      body.to_place_id ?? null,
      req.params.id,
    );

    // Erst jetzt löschen: die travel_items-Zeile verweist nicht mehr auf die alte Ausgabe.
    if (staleIdToDelete) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(staleIdToDelete);
    }

    return db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/travel/:id', async (req, reply) => {
    const existing = db.prepare('SELECT * FROM travel_items WHERE id = ?').get(req.params.id) as
      | TravelRow
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    db.prepare('DELETE FROM travel_items WHERE id = ?').run(req.params.id);
    if (existing.budget_expense_id) {
      db.prepare('DELETE FROM budget_items WHERE id = ?').run(existing.budget_expense_id);
    }
    // Verwaiste Stationsreferenzen (Ausflüge, die den Abflug-/Ankunftsort dieses Eintrags als
    // Station eingeplant hatten) mit entfernen – siehe gleiches Vorgehen in routes/spots.ts. Beide
    // Seiten (from/to) gehören zum selben Eintrag, daher hier immer beide Keys entfernen.
    db.prepare('DELETE FROM excursion_spots WHERE station_key IN (?, ?)').run(
      `travel-from-${req.params.id}`,
      `travel-to-${req.params.id}`,
    );
    return reply.code(204).send();
  });
};
