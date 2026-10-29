import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('uploads route security (#629)', () => {
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

  const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  it('rejects unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/uploads/some-file.png',
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Nicht eingeloggt' });
  });

  it('rejects path traversal attempts with 400', async () => {
    const user = await register('user_pt', 'user_pt@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/uploads/%2E%2E%2Fsecret.png',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for non-existent or unmapped files', async () => {
    const user = await register('user_404', 'user_404@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/api/uploads/does-not-exist.png',
      headers: { cookie: user.cookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'Nicht gefunden' });
  });

  it('enforces trip membership authorization on uploads (members 200, outsiders and admins 403)', async () => {
    // Erster registrierter Account ist in Reisotor automatisch Admin
    const admin = await register('admin_user', 'admin@example.com');
    const member = await register('trip_member', 'member@example.com');
    const outsider = await register('outsider_user', 'outsider@example.com');

    // Trip anlegen als trip_member
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: member.cookie },
      payload: { name: 'Geheimer Urlaub', start_date: '2026-06-01', end_date: '2026-06-10' },
    });
    const tripId = tripRes.json().id as number;

    // Bild hochladen im Kontext dieses Urlaubs
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/diary/images',
      headers: { cookie: member.cookie },
      payload: {
        data: `data:image/png;base64,${TINY_PNG_BASE64}`,
        filename: 'secret.png',
        trip_id: tripId,
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const imageUrl = uploadRes.json().url as string;
    expect(imageUrl).toMatch(/^\/api\/uploads\//);

    // 1. Unangemeldet -> 401
    const unauth = await app.inject({
      method: 'GET',
      url: imageUrl,
    });
    expect(unauth.statusCode).toBe(401);

    // 2. Outsider (angemeldet, aber kein Mitglied) -> 403
    const outsiderRes = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: outsider.cookie },
    });
    expect(outsiderRes.statusCode).toBe(403);
    expect(outsiderRes.json()).toEqual({ error: 'Kein Zugriff auf diesen Urlaub' });

    // 3. Admin (angemeldet, aber kein Mitglied) -> 403 (Gleichbehandlungsregel)
    const adminRes = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: admin.cookie },
    });
    expect(adminRes.statusCode).toBe(403);
    expect(adminRes.json()).toEqual({ error: 'Kein Zugriff auf diesen Urlaub' });

    // 4. Trip-Mitglied -> 200 + private Cache-Header + nosniff
    const memberRes = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: member.cookie },
    });
    expect(memberRes.statusCode).toBe(200);
    expect(memberRes.headers['cache-control']).toBe('private, max-age=3600');
    expect(memberRes.headers['x-content-type-options']).toBe('nosniff');
    expect(memberRes.body.length).toBeGreaterThan(0);
  });

  it('allows access to initial draft uploads only for uploader, and grants trip access after association', async () => {
    const creator = await register('draft_creator', 'creator@example.com');
    const otherUser = await register('other_user', 'other@example.com');

    // Upload ohne trip_id (z.B. vor dem ersten Speichern eines Trips)
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/images',
      headers: { cookie: creator.cookie },
      payload: {
        data: `data:image/png;base64,${TINY_PNG_BASE64}`,
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const imageUrl = uploadRes.json().url as string;

    // Ersteller hat Zugriff
    const creatorRes = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: creator.cookie },
    });
    expect(creatorRes.statusCode).toBe(200);

    // Anderer Nutzer hat noch keinen Zugriff (403)
    const otherBefore = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: otherUser.cookie },
    });
    expect(otherBefore.statusCode).toBe(403);

    // Trip anlegen und otherUser einladen
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: creator.cookie },
      payload: {
        name: 'Neuer Trip mit Cover',
        image_url: imageUrl,
      },
    });
    const tripId = tripRes.json().id as number;

    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: creator.cookie },
      payload: { user_id: otherUser.userId },
    });

    // Jetzt ist otherUser Mitglied des Trips und darf das Bild ebenfalls abrufen
    const otherAfter = await app.inject({
      method: 'GET',
      url: imageUrl,
      headers: { cookie: otherUser.cookie },
    });
    expect(otherAfter.statusCode).toBe(200);
  });
});
