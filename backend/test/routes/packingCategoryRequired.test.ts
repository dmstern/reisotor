import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('packing category required per trip', () => {
  let app: FastifyInstance;
  let db: Database.Database;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'catreqtester',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'catreqtester', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Kategorie-Testreise', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    tripId = tripRes.json().id;
  });

  it('defaults a newly created trip to requiring a category', () => {
    const trip = db
      .prepare('SELECT packing_category_required FROM trips WHERE id = ?')
      .get(tripId) as {
      packing_category_required: number;
    };
    expect(trip.packing_category_required).toBe(1);
  });

  it('rejects a category-less packing item when the trip requires a category', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, label: 'Ohne Kategorie' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows a category-less packing item once the trip opts out via PUT /trips/:id', async () => {
    const putRes = await app.inject({
      method: 'PUT',
      url: `/api/trips/${tripId}`,
      headers: { cookie },
      payload: {
        name: 'Kategorie-Testreise',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        packing_category_required: false,
      },
    });
    expect(putRes.json().packing_category_required).toBe(0);

    const res = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, label: 'Ohne Kategorie ist jetzt ok' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('still allows updating an already category-less item (e.g. just toggling packed state) once the trip requires a category again', async () => {
    // Zu diesem Zeitpunkt ist packing_category_required für diesen Trip noch false (vorheriger
    // Test) - das Item wird also bewusst ohne Kategorie angelegt.
    const created = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, label: 'War schon vor der Umstellung ohne Kategorie' },
    });
    const id = created.json().id;

    await app.inject({
      method: 'PUT',
      url: `/api/trips/${tripId}`,
      headers: { cookie },
      payload: {
        name: 'Kategorie-Testreise',
        start_date: '2026-01-01',
        end_date: '2026-01-10',
        packing_category_required: true,
      },
    });

    // Nur der Pack-Status ändert sich, die (schon leere) Kategorie bleibt unverändert leer - das
    // darf trotz jetzt aktivierter Pflicht nicht blockiert werden, sonst ließen sich bestehende
    // Gegenstände nicht mehr abhaken.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/packing/${id}`,
      headers: { cookie },
      payload: {
        label: 'War schon vor der Umstellung ohne Kategorie',
        quantity: 1,
        packed_count: 1,
        laid_out_count: 1,
      },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects clearing a previously-set category while the trip requires one', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/packing',
      headers: { cookie },
      payload: { trip_id: tripId, category: 'Kleidung', label: 'Hat schon eine Kategorie' },
    });
    const id = created.json().id;

    const res = await app.inject({
      method: 'PUT',
      url: `/api/packing/${id}`,
      headers: { cookie },
      payload: { label: 'Hat schon eine Kategorie', quantity: 1 },
    });
    expect(res.statusCode).toBe(400);
  });
});
