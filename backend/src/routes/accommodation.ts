import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface AccommodationBody {
  name: string;
  address?: string;
  link?: string;
  maps_link?: string;
  start_date?: string;
  end_date?: string;
  checkin?: string;
  checkout?: string;
  contact?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

export const accommodationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/accommodation', async () => {
    return db.prepare('SELECT * FROM accommodation ORDER BY start_date, id').all();
  });

  app.post<{ Body: AccommodationBody }>('/accommodation', async (req, reply) => {
    const { name, address, link, maps_link, start_date, end_date, checkin, checkout, contact, note, lat, lng } =
      req.body;
    const result = db
      .prepare(
        `INSERT INTO accommodation
          (name, address, link, maps_link, start_date, end_date, checkin, checkout, contact, note, lat, lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        name,
        address ?? null,
        link ?? null,
        maps_link ?? null,
        start_date ?? null,
        end_date ?? null,
        checkin ?? null,
        checkout ?? null,
        contact ?? null,
        note ?? null,
        lat ?? null,
        lng ?? null,
      );
    reply.code(201);
    return db.prepare('SELECT * FROM accommodation WHERE id = ?').get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: AccommodationBody }>('/accommodation/:id', async (req, reply) => {
    const { name, address, link, maps_link, start_date, end_date, checkin, checkout, contact, note, lat, lng } =
      req.body;
    const result = db
      .prepare(
        `UPDATE accommodation SET name = ?, address = ?, link = ?, maps_link = ?, start_date = ?, end_date = ?,
           checkin = ?, checkout = ?, contact = ?, note = ?, lat = ?, lng = ? WHERE id = ?`,
      )
      .run(
        name,
        address ?? null,
        link ?? null,
        maps_link ?? null,
        start_date ?? null,
        end_date ?? null,
        checkin ?? null,
        checkout ?? null,
        contact ?? null,
        note ?? null,
        lat ?? null,
        lng ?? null,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return db.prepare('SELECT * FROM accommodation WHERE id = ?').get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/accommodation/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM accommodation WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
