import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für das Echtzeit-Sync-Aktivitätsprotokoll (activity.ts/routes/realtime.ts):
// Auth-Gating der beiden HTTP-Endpunkte (SSE-Stream + Nachhol-Protokoll) und dass recordActivity()
// (über eine ganz normale Mutation ausgelöst) tatsächlich einen abrufbaren trip_activity-Eintrag
// hinterlässt. Der SSE-Stream selbst bleibt bewusst offen (reply.hijack()) und lässt sich daher
// nicht sinnvoll über app.inject() bis zum Ende durchlaufen - nur die Guard-Clauses (400/403, vor
// dem hijack()) sind hier testbar, das eigentliche Streaming ist manuell/per E2E verifiziert.
describe('realtime routes (SSE stream + trip-activity backfill)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  async function register(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { cookie, userId: res.json().id as number };
  }

  it('GET /realtime/stream requires trip_id and membership', async () => {
    const owner = await register('gustav', 'gustav@example.com');
    const outsider = await register('helga', 'helga@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Streaming-Trip', start_date: '2026-03-01', end_date: '2026-03-05' },
    });
    const tripId = tripRes.json().id;

    const missingTripId = await app.inject({
      method: 'GET',
      url: '/api/realtime/stream',
      headers: { cookie: owner.cookie },
    });
    expect(missingTripId.statusCode).toBe(400);

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/realtime/stream?trip_id=${tripId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(forbidden.statusCode).toBe(403);
  });

  it('GET /trip-activity requires trip_id and membership, and lists activity after a mutation', async () => {
    const owner = await register('ingo', 'ingo@example.com');
    const outsider = await register('juna', 'juna@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Aktivitäts-Trip', start_date: '2026-04-01', end_date: '2026-04-05' },
    });
    const tripId = tripRes.json().id;

    const missingTripId = await app.inject({
      method: 'GET',
      url: '/api/trip-activity',
      headers: { cookie: owner.cookie },
    });
    expect(missingTripId.statusCode).toBe(400);

    const forbidden = await app.inject({
      method: 'GET',
      url: `/api/trip-activity?trip_id=${tripId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(forbidden.statusCode).toBe(403);

    // -1ms statt des exakten "jetzt": created_at (activity.ts's recordActivity()) hat nur
    // Millisekunden-Auflösung - auf einem schnellen CI-Runner kann die gleich danach ausgelöste
    // Mutation denselben Millisekunden-Zeitstempel bekommen wie dieses `since`, wodurch der
    // strikte "created_at > since"-Filter (routes/realtime.ts) die Zeile fälschlich ausschließt.
    const beforeCreate = new Date(Date.now() - 1).toISOString();

    const todoRes = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, title: 'Koffer packen' },
    });
    const todoId = todoRes.json().id;

    const activity = await app.inject({
      method: 'GET',
      url: `/api/trip-activity?trip_id=${tripId}&since=${encodeURIComponent(beforeCreate)}`,
      headers: { cookie: owner.cookie },
    });
    expect(activity.statusCode).toBe(200);
    const rows = activity.json() as {
      domain: string;
      entity_id: number;
      action: string;
      actor_user_id: number;
    }[];
    expect(rows).toContainEqual(
      expect.objectContaining({
        domain: 'todos',
        entity_id: todoId,
        action: 'created',
        actor_user_id: owner.userId,
      })
    );
  });

  // Live-Standort auf der Karte (activity.ts's positionsFor/updatePosition/clearPosition): rein
  // ephemer, kein trip_activity-Eintrag – hier nur das Auth-Gating der beiden HTTP-Endpunkte
  // testbar (der eigentliche SSE-Broadcast läuft über dieselbe offene Verbindung wie oben, siehe
  // Kommentar zur nicht sinnvoll per app.inject() durchlaufbaren SSE-Route).
  it('POST/DELETE /realtime/position require trip_id and membership', async () => {
    const owner = await register('katja', 'katja@example.com');
    const outsider = await register('linus', 'linus@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Standort-Trip', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const tripId = tripRes.json().id;

    const forbiddenPost = await app.inject({
      method: 'POST',
      url: '/api/realtime/position',
      headers: { cookie: outsider.cookie },
      payload: { trip_id: tripId, lat: 48.2, lng: 16.3 },
    });
    expect(forbiddenPost.statusCode).toBe(403);

    const missingLatLng = await app.inject({
      method: 'POST',
      url: '/api/realtime/position',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId },
    });
    expect(missingLatLng.statusCode).toBe(400);

    const okPost = await app.inject({
      method: 'POST',
      url: '/api/realtime/position',
      headers: { cookie: owner.cookie },
      payload: { trip_id: tripId, lat: 48.2, lng: 16.3 },
    });
    expect(okPost.statusCode).toBe(204);

    const forbiddenDelete = await app.inject({
      method: 'DELETE',
      url: `/api/realtime/position?trip_id=${tripId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(forbiddenDelete.statusCode).toBe(403);

    const okDelete = await app.inject({
      method: 'DELETE',
      url: `/api/realtime/position?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(okDelete.statusCode).toBe(204);
  });
});
