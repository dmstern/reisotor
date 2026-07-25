import type { FastifyPluginAsync } from 'fastify';
import { db } from '../db/index.js';

interface ScheduleBody {
  trip_id: number;
  date: string;
  end_date?: string | null;
  time?: string;
  title: string;
  note?: string;
  idea_id?: number | null;
  location?: string;
  maps_link?: string;
  lat?: number;
  lng?: number;
}

// Termine, die mit einem Ausflug verknüpft sind, teilen sich den Titel als eine Instanz:
// Die Quelle der Wahrheit ist der Ausflug (ideas.title), der Kalender-Termin übernimmt ihn beim
// Lesen per JOIN. Bearbeitet wird der Titel ausschließlich in der Ausflüge-Ansicht (Architekturregel
// aus Batch 3: Fremdobjekte sind in der einbettenden Sicht nicht direkt editierbar).
const SELECT_WITH_TITLE = `
  SELECT s.*, COALESCE(i.title, s.title) AS title
  FROM schedule_items s
  LEFT JOIN ideas i ON i.id = s.idea_id
`;

function deriveCategory(ideaId: number | null | undefined) {
  return ideaId ? 'excursion' : 'other';
}

export const scheduleRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { trip_id?: string } }>('/schedule', async (req, reply) => {
    if (!req.query.trip_id) return reply.code(400).send({ error: 'trip_id erforderlich' });
    return db
      .prepare(`${SELECT_WITH_TITLE} WHERE s.trip_id = ? ORDER BY s.date, s.time`)
      .all(req.query.trip_id);
  });

  app.post<{ Body: ScheduleBody }>('/schedule', async (req, reply) => {
    const { trip_id, date, end_date, time, title, note, idea_id, location, maps_link, lat, lng } = req.body;
    const category = deriveCategory(idea_id);
    const result = db
      .prepare(
        `INSERT INTO schedule_items (trip_id, date, end_date, time, title, note, idea_id, location, maps_link, lat, lng, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trip_id,
        date,
        end_date ?? null,
        time ?? null,
        title,
        note ?? null,
        idea_id ?? null,
        location ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        category,
      );
    if (idea_id) {
      db.prepare("UPDATE ideas SET status = 'planned' WHERE id = ?").run(idea_id);
    }
    reply.code(201);
    return db.prepare(`${SELECT_WITH_TITLE} WHERE s.id = ?`).get(result.lastInsertRowid);
  });

  app.put<{ Params: { id: string }; Body: ScheduleBody }>('/schedule/:id', async (req, reply) => {
    const { date, end_date, time, title, note, idea_id, location, maps_link, lat, lng } = req.body;
    const category = deriveCategory(idea_id);
    const result = db
      .prepare(
        `UPDATE schedule_items
         SET date = ?, end_date = ?, time = ?, title = ?, note = ?, idea_id = ?, location = ?, maps_link = ?, lat = ?, lng = ?, category = ?
         WHERE id = ?`,
      )
      .run(
        date,
        end_date ?? null,
        time ?? null,
        title,
        note ?? null,
        idea_id ?? null,
        location ?? null,
        maps_link ?? null,
        lat ?? null,
        lng ?? null,
        category,
        req.params.id,
      );
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    if (idea_id) {
      db.prepare("UPDATE ideas SET status = 'planned' WHERE id = ?").run(idea_id);
    }
    return db.prepare(`${SELECT_WITH_TITLE} WHERE s.id = ?`).get(req.params.id);
  });

  app.delete<{ Params: { id: string } }>('/schedule/:id', async (req, reply) => {
    const result = db.prepare('DELETE FROM schedule_items WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return reply.code(404).send({ error: 'Nicht gefunden' });
    return reply.code(204).send();
  });
};
