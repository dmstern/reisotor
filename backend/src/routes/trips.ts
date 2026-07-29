import type { FastifyPluginAsync } from 'fastify';
import { db, ensureDefaultSharedBudget } from '../db/index.js';
import { resolveLatLng, tilePreviewUrl } from '../utils/mapsLink.js';

interface TripBody {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
  image_url?: string;
}

export const tripsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/trips', async () => {
    return db.prepare('SELECT * FROM trips ORDER BY id').all();
  });

  app.get<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    const trip = db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
    if (!trip) return reply.code(404).send({ error: 'Nicht gefunden' });
    return trip;
  });

  app.post<{ Body: TripBody }>('/trips', async (req, reply) => {
    const { name, destination, start_date, end_date, maps_link } = req.body;
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
        'INSERT INTO trips (name, destination, start_date, end_date, maps_link, lat, lng, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(name, destination ?? null, start_date, end_date, maps_link ?? null, lat ?? null, lng ?? null, image_url ?? null);
    const tripId = result.lastInsertRowid as number;
    ensureDefaultSharedBudget(tripId);
    reply.code(201);
    return db.prepare('SELECT * FROM trips WHERE id = ?').get(tripId);
  });

  app.put<{ Params: { id: string }; Body: TripBody }>('/trips/:id', async (req, reply) => {
    const existing = db.prepare('SELECT lat, lng FROM trips WHERE id = ?').get(req.params.id) as
      | { lat: number | null; lng: number | null }
      | undefined;
    if (!existing) return reply.code(404).send({ error: 'Nicht gefunden' });

    const { name, destination, start_date, end_date, maps_link } = req.body;
    let { lat, lng, image_url } = req.body;
    if ((lat == null || lng == null) && maps_link) {
      const resolved = await resolveLatLng(maps_link);
      lat = resolved?.lat;
      lng = resolved?.lng;
    }
    // Schlägt die (erneute) Auflösung fehl, obwohl weiterhin ein Maps-Link hinterlegt ist (z. B.
    // transienter Netzwerkfehler beim Bearbeiten eines unabhängigen Felds), bisherige Koordinaten
    // behalten statt sie zu löschen. Wird der Maps-Link dagegen bewusst geleert, bleibt lat/lng wie
    // bisher null (Ort wurde absichtlich entfernt).
    if ((lat == null || lng == null) && maps_link) {
      lat = lat ?? existing.lat ?? undefined;
      lng = lng ?? existing.lng ?? undefined;
    }
    if (!image_url && lat != null && lng != null) {
      image_url = tilePreviewUrl(lat, lng);
    }
    const result = db
      .prepare(
        'UPDATE trips SET name = ?, destination = ?, start_date = ?, end_date = ?, maps_link = ?, lat = ?, lng = ?, image_url = ? WHERE id = ?',
      )
      .run(
        name,
        destination ?? null,
        start_date,
        end_date,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        image_url ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM trips WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/trips/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM trips WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
