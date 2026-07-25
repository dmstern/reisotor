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
  discarded?: boolean;
}

export const spotsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/spots', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db.prepare('SELECT * FROM spots WHERE trip_id = ? ORDER BY title COLLATE NOCASE').all(req.query.trip_id);
  });

  app.post<{ Body: SpotBody }>('/spots', async (req, reply) => {
    const { trip_id, title, category, note, maps_link, discarded } = req.body;
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
        `INSERT INTO spots (trip_id, title, image_url, category, note, maps_link, lat, lng, created_by, discarded)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        discarded ? 1 : 0,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: SpotBody }>('/spots/:id', async (req, reply) => {
    const { title, category, note, maps_link, discarded } = req.body;
    let { lat, lng, image_url } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const result = db
      .prepare(
        `UPDATE spots SET title = ?, image_url = ?, category = ?, note = ?, maps_link = ?, lat = ?, lng = ?, discarded = ?
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
        discarded ? 1 : 0,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM spots WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/spots/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM spots WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
