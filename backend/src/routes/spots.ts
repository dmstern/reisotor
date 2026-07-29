import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';

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
    return db.prepare('SELECT * FROM spots WHERE trip_id = ? ORDER BY title COLLATE NOCASE').all(req.query.trip_id);
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const { trip_id, title, category, note, maps_link } = req.body;
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
    const existing = db.prepare('SELECT lat, lng FROM spots WHERE id = ?').get(req.params.id) as
      | { lat: number | null; lng: number | null }
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

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

  app.delete<{ Params: { id: string } }>('/spots/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM spots WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    // excursion_spots.station_key ist kein Fremdschlüssel mehr (generischer Text statt spot_id
    // mit ON DELETE CASCADE) – verwaiste Stationsreferenzen auf den gelöschten Spot müssen daher
    // manuell mit entfernt werden.
    db.prepare('DELETE FROM excursion_spots WHERE station_key = ?').run(`spot-${req.params.id}`);
    return reply.code(204).send();
  });

  // --- Likes/Kommentare (analog /ideas/likes, /ideas/comments) ---

  app.get<{ Querystring: { trip_id?: string } }>('/spots/likes', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT spot_likes.* FROM spot_likes
         JOIN spots ON spots.id = spot_likes.spot_id
         WHERE spots.trip_id = ?`,
      )
      .all(req.query.trip_id);
  });

  app.get<{ Querystring: { trip_id?: string } }>('/spots/comments', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(
        `SELECT spot_comments.* FROM spot_comments
         JOIN spots ON spots.id = spot_comments.spot_id
         WHERE spots.trip_id = ?
         ORDER BY spot_comments.created_at ASC, spot_comments.id ASC`,
      )
      .all(req.query.trip_id);
  });

  app.post<{ Params: { id: string } }>('/spots/:id/like', async (req, reply) => {
    const spot = db.prepare('SELECT id FROM spots WHERE id = ?').get(req.params.id);
    if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });

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
    const spot = db.prepare('SELECT id FROM spots WHERE id = ?').get(req.params.id);
    if (!spot) return reply.code(404).send({ error: 'Nicht gefunden' });

    const result = db
      .prepare('INSERT INTO spot_comments (spot_id, author_id, content, created_at) VALUES (?, ?, ?, ?)')
      .run(req.params.id, req.session.userId, req.body.content, new Date().toISOString());
    reply.code(201);
    return db.prepare('SELECT * FROM spot_comments WHERE id = ?').get(result.lastInsertRowid);
  });

  app.delete<{ Params: { id: string } }>('/spots/comments/:id', async (req, reply) => {
    const comment = db.prepare('SELECT * FROM spot_comments WHERE id = ?').get(req.params.id) as
      | { id: number; author_id: number }
      | undefined;
    if (!comment) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (comment.author_id !== req.session.userId) {
      return reply.code(403).send({ error: 'Nur die Autorin/der Autor kann diesen Kommentar löschen' });
    }
    db.prepare('DELETE FROM spot_comments WHERE id = ?').run(req.params.id);
    return reply.code(204).send();
  });
};
