import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// #106: ein Spot/eine Tour darf nicht ohne Datum "gemacht" sein (eindeutige Statuskette
// in Planung -> geplant -> gemacht statt zweier unabhängiger Flags). Deckt sowohl den direkten
// Weg (schedule_items.spot_id/idea_id) als auch den indirekten (Spot als Station einer bereits
// terminierten Tour, siehe DiaryView.vue's "Spot direkt zuordnen"-Picker/routes/ideas.ts's
// plan-spot) ab.
describe('done requires date (#106)', () => {
  let app: FastifyInstance;
  let cookie: string;
  let tripId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('testuser', bcrypt.hashSync('correct-horse', 10), '🧪');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Testreise', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    tripId = tripRes.json().id;
  });

  async function createSpot(title: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie },
      payload: { trip_id: tripId, title, category: 'Sehenswürdigkeit' },
    });
    return res.json().id as number;
  }

  it('rejects marking an unplanned spot as done', async () => {
    const spotId = await createSpot('Unplanter Spot');
    const res = await app.inject({
      method: 'POST',
      url: `/api/spots/${spotId}/done`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows marking a spot as done once it has a directly linked schedule date', async () => {
    const spotId = await createSpot('Geplanter Spot');
    await app.inject({
      method: 'POST',
      url: '/api/schedule',
      headers: { cookie },
      payload: { trip_id: tripId, date: '2026-01-02', title: 'Geplanter Spot', spot_id: spotId },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/spots/${spotId}/done`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().done).toBe(true);
  });

  it('allows un-marking a done spot without requiring a date', async () => {
    const spotId = await createSpot('Wird wieder geplant');
    await app.inject({
      method: 'POST',
      url: '/api/schedule',
      headers: { cookie },
      payload: { trip_id: tripId, date: '2026-01-03', title: 'Wird wieder geplant', spot_id: spotId },
    });
    await app.inject({
      method: 'POST',
      url: `/api/spots/${spotId}/done`,
      headers: { cookie },
      payload: { done: true },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/spots/${spotId}/done`,
      headers: { cookie },
      payload: { done: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().done).toBe(false);
  });

  it('allows marking a spot as done when it is a station of an already-dated tour', async () => {
    const spotId = await createSpot('Tour-Station');
    await app.inject({
      method: 'POST',
      url: '/api/ideas/plan-spot',
      headers: { cookie },
      payload: { trip_id: tripId, spot_id: spotId, date: '2026-01-04' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/spots/${spotId}/done`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().done).toBe(true);
  });

  it('rejects marking an unplanned tour as done', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: { trip_id: tripId, title: 'Unplante Tour' },
    });
    const ideaId = created.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/ideas/${ideaId}/done`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('allows marking a tour as done once it has a schedule date', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie },
      payload: { trip_id: tripId, title: 'Geplante Tour', date: '2026-01-05' },
    });
    const ideaId = created.json().id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/ideas/${ideaId}/done`,
      headers: { cookie },
      payload: { done: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().done).toBe(true);
  });
});
