import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface AccommodationBody {
  name: string;
  address?: string;
  link?: string;
  checkin?: string;
  checkout?: string;
  contact?: string;
  note?: string;
  lat?: number;
  lng?: number;
}

export const accommodationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/accommodation', async () => {
    return db.prepare('SELECT * FROM accommodation WHERE id = 1').get() ?? null;
  });

  app.put<{ Body: AccommodationBody }>('/accommodation', async (req) => {
    const { name, address, link, checkin, checkout, contact, note, lat, lng } = req.body;
    db.prepare(
      `INSERT INTO accommodation (id, name, address, link, checkin, checkout, contact, note, lat, lng)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = excluded.address,
         link = excluded.link, checkin = excluded.checkin, checkout = excluded.checkout,
         contact = excluded.contact, note = excluded.note, lat = excluded.lat, lng = excluded.lng`,
    ).run(
      name,
      address ?? null,
      link ?? null,
      checkin ?? null,
      checkout ?? null,
      contact ?? null,
      note ?? null,
      lat ?? null,
      lng ?? null,
    );
    return db.prepare('SELECT * FROM accommodation WHERE id = 1').get();
  });
};
