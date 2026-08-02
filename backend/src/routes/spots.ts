import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';
import { requireTripMember } from '../tripAccess.js';

interface SpotBody {
  trip_id: number;
  title: string;
  image_url?: string;
  category?: string;
  note?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
}

interface CommentBody {
  content: string;
}

export const spotsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/spots', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare('SELECT * FROM spots WHERE trip_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE')
      .all(req.query.trip_id);
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const { trip_id, title, category, note, maps_link } = req.body;
    if (!requireTripMember(reply, trip_id, req.session.userId)) return;
    let { lat, lng, image_url } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    // Kein eigenes Bild hinterlegt, aber ein Standort bekannt: automatisches Vorschaubild
    // (Kartenausschnitt) statt eines leeren Platzhalters.
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const result = db
      .prepare(
        `INSERT INTO spots (trip_id, title, image_url, category, note, maps_link, lat, lng, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        title,
        image_url ?? null,
        category ?? null,
        note ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        req.session.userId,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: SpotBody }>('/spots/:id', async (req, reply) => {
    const existing = db.prepare('SELECT trip_id, lat, lng FROM spots WHERE id = ?').get(req.params.id) as
      | { trip_id: number; lat: number | null; lng: number | null }
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existing.trip_id, req.session.userId)) return;

    const { title, category, note, maps_link } = req.body;
    let { lat, lng, image_url } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    // Schlägt die (erneute) Auflösung fehl, obwohl weiterhin ein Maps-Link hinterlegt ist,
    // bisherige Koordinaten behalten statt sie zu löschen (siehe gleiches Muster in trips.ts).
    if ((lat == null || lng == null) && maps_link) {
      lat = lat ?? existing.lat ?? undefined;
      lng = lng ?? existing.lng ?? undefined;
    }
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const result = db
      .prepare(
        `UPDATE spots SET title = ?, image_url = ?, category = ?, note = ?, maps_link = ?, lat = ?, lng = ?
         WHERE id = ?`,
      )
      .run(
        title,
        image_url ?? null,
        category ?? null,
        note ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  });

  // Weicher Löschvorgang (Papierkorb, routes/trash.ts): setzt nur deleted_at statt die Zeile
  // wirklich zu entfernen. excursion_spots-Stationsreferenzen auf den Spot bleiben dabei bewusst
  // bestehen (kein Cleanup mehr nötig) – resolveStation() im Frontend liefert für einen nicht mehr
  // gefundenen (weil ausgeblendeten) Spot ohnehin `null` und die Station verschwindet dadurch
  // automatisch aus jeder Stationsliste, taucht nach dem Wiederherstellen aber unverändert wieder auf.
  app.delete<{ Params: { id: string } }>('/spots/:id', async (req, reply) => {
    const existing = db.prepare('SELECT trip_id FROM spots WHERE id = ?').get(req.params.id) as
      | { trip_id: number }
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, existing.trip_id, req.session.userId)) return;

    const result = db
      .prepare('UPDATE spots SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
      .run(new Date().toISOString(), req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });

  // --- Likes/Kommentare (analog /ideas/likes, /ideas/comments) ---

  app.get<{ Querystring: { trip_id?: string } }>('/spots/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT spot_likes.* FROM spot_likes
         JOIN spots ON spots.id = spot_likes.spot_id
         WHERE spots.trip_id = ? AND spots.deleted_at IS NULL`,
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/spots/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    if (!requireTripMember(reply, req.query.trip_id, req.session.userId)) return;
    return db
      .prepare(
        `SELECT spot_comments.* FROM spot_comments
         JOIN spots ON spots.id = spot_comments.spot_id
         WHERE spots.trip_id = ? AND spots.deleted_at IS NULL
         ORDER BY spot_comments.created_at ASC, spot_comments.id ASC`,
      )
      .all(req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/spots/:id/like', async (req, reply) => {
    const spot = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, spot.trip_id, req.session.userId)) return;

    const existing = db
      .prepare('SELECT id FROM spot_likes WHERE spot_id = ? AND user_id = ?')
      .get(req.params.id, req.session.userId) as { id: number } | undefined;

    if (existing) {
      db.prepare('DELETE FROM spot_likes WHERE id = ?').run(existing.id);
      return { liked: false };
    }

    db.prepare('INSERT INTO spot_likes (spot_id, user_id, created_at) VALUES (?, ?, ?)').run(
      req.params.id,
      req.session.userId,
      new Date().toISOString(),
    );
    return { liked: true };
  });

  app.post<{ Params: { id: string }; Body: CommentBody }>('/spots/:id/comments', async (req, reply) => {
    const spot = db.prepare('SELECT id, trip_id FROM spots WHERE id = ?').get(req.params.id) as
      | { id: number; trip_id: number }
      | undefined;
    if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, spot.trip_id, req.session.userId)) return;

    const result = db
      .prepare('INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM spot_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/spots/comments/:id', async (req, reply) => {
    const comment = db
      .prepare(
        `SELECT spot_comments.id, spot_comments.author_id, spots.trip_id FROM spot_comments
         JOIN spots ON spots.id = spot_comments.spot_id
         WHERE spot_comments.id = ?`,
      )
      .get(req.params.id) as { id: number; author_id: number; trip_id: number } | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (!requireTripMember(reply, comment.trip_id, req.session.userId)) return;
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM spot_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
