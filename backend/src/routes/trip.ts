import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface TripBody {
  name: string;
  destination?: string;
  start_date: string;
  end_date: string;
}

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.get('/trip', async () => {
    return db.prepare('SELECT * FROM trip WHERE id = 1').get() ?? null;
  });

  app.put<{ Body: TripBody }>('/trip', async (req) => {
    const { name, destination, start_date, end_date } = req.body;
    db.prepare(
      `INSERT INTO trip (id, name, destination, start_date, end_date) VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, destination = excluded.destination,
         start_date = excluded.start_date, end_date = excluded.end_date`,
    ).run(name, destination ?? null, start_date, end_date);
    return db.prepare('SELECT * FROM trip WHERE id = 1').get();
  });
};
