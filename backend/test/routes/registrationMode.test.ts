import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für Issue #96 (konfigurierbare Registrierung): REGISTRATION_MODE=restricted
// markiert neu registrierte Accounts dauerhaft als eingeschränkt (Datei-Upload, Urlaub-Anlegen,
// Mitglieder-Deckel), REGISTRATION_FULL_ACCESS_USERS hebt das für einzelne Benutzernamen wieder
// auf. Muss VOR dem dynamischen App-Import gesetzt werden, siehe buildTestApp.ts's Kommentar zur
// Modul-Singleton-Reihenfolge - registrationConfig.ts liest REGISTRATION_MODE nur einmal beim
// ersten Import.
describe('registration mode: restricted', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.REGISTRATION_MODE = 'restricted';
    process.env.REGISTRATION_FULL_ACCESS_USERS = 'vip';
    const built = await buildTestApp();
    app = built.app;
  });

  async function register(username: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email: `${username}@example.com`, password: 'correct-horse' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { res, cookie, userId: res.json().id as number };
  }

  it('GET /auth/config reports the configured mode', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/config' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ registrationMode: 'restricted' });
  });

  it('marks a self-registered user as restricted', async () => {
    const { res } = await register('restricted-user');
    expect(res.json()).toMatchObject({ restricted: true });
  });

  it('exempts full-access usernames from the restricted flag', async () => {
    const { res } = await register('vip');
    expect(res.json()).toMatchObject({ restricted: false });
  });

  it('blocks file upload attempts for restricted users', async () => {
    const { cookie } = await register('uploader');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Trip', start_date: '2026-05-01', end_date: '2026-05-05' },
    });
    const tripId = tripRes.json().id;

    const noteRes = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie },
      payload: { trip_id: tripId, title: 'Ticket', content: 'x' },
    });
    const noteId = noteRes.json().id;

    const upload = await app.inject({
      method: 'POST',
      url: '/api/attachments',
      headers: { cookie },
      payload: {
        domain: 'notes',
        entity_id: noteId,
        data: 'data:image/png;base64,x',
        filename: 'x.png',
      },
    });
    expect(upload.statusCode).toBe(403);
    expect(upload.json()).toEqual({ error: 'Eingeschränkter Modus - Kein Datei-Upload möglich' });
  });

  it('allows only one self-created trip for restricted users', async () => {
    const { cookie } = await register('one-trip');
    const first = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Erster Urlaub', start_date: '2026-05-01', end_date: '2026-05-05' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie },
      payload: { name: 'Zweiter Urlaub', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    expect(second.statusCode).toBe(403);
    expect(second.json()).toEqual({ error: 'Eingeschränkter Modus - Nur ein Urlaub pro Nutzer' });
  });

  it('caps a restricted-owned trip at 3 members total', async () => {
    const { cookie: ownerCookie } = await register('capped-owner');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: ownerCookie },
      payload: { name: 'Gedeckelter Urlaub', start_date: '2026-05-01', end_date: '2026-05-05' },
    });
    const tripId = tripRes.json().id;

    const { userId: memberTwoId } = await register('member-two');
    const { userId: memberThreeId } = await register('member-three');
    const { userId: memberFourId } = await register('member-four');

    // Owner (1) + member-two (2) + member-three (3) = am erlaubten Deckel angekommen.
    const invite1 = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberTwoId },
    });
    expect(invite1.statusCode).toBe(201);

    const invite2 = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberThreeId },
    });
    expect(invite2.statusCode).toBe(201);

    // Ein viertes Mitglied überschreitet den Deckel (max. 3 insgesamt).
    const invite3 = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberFourId },
    });
    expect(invite3.statusCode).toBe(403);
    expect(invite3.json()).toEqual({
      error: 'Eingeschränkter Modus - Maximal drei Nutzer pro Urlaub',
    });
  });
});
