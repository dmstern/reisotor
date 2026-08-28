import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für das Mitgliedschaftskonzept (Batch: Registrierung + Einladung, siehe
// tripAccess.ts): neu angelegte Urlaube sind zunächst nur für die anlegende Person sichtbar, alle
// bestehenden Urlaub-bezogenen Endpunkte müssen das durchsetzen (Auth-Gating, siehe CLAUDE.md).
describe('trip membership + registration + invite', () => {
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
    return { res, cookie, userId: res.json().id as number };
  }

  it('registers a new account with email and logs it in directly', async () => {
    const { res, cookie } = await register('alice', 'alice@example.com');
    expect(res.statusCode).toBe(201);
    expect(res.json().username).toBe('alice');

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().username).toBe('alice');
  });

  it('rejects registration with a duplicate username or email', async () => {
    await register('bob', 'bob@example.com');
    const dupUsername = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob', email: 'someone-else@example.com', password: 'correct-horse' },
    });
    expect(dupUsername.statusCode).toBe(409);

    const dupEmail = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'bob2', email: 'bob@example.com', password: 'correct-horse' },
    });
    expect(dupEmail.statusCode).toBe(409);
  });

  it('a newly created trip is only visible to its creator, not to other registered users', async () => {
    const owner = await register('carol', 'carol@example.com');
    const outsider = await register('dave', 'dave@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Privater Trip', start_date: '2026-01-01', end_date: '2026-01-10' },
    });
    const tripId = tripRes.json().id;

    const outsiderList = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie: outsider.cookie },
    });
    expect(outsiderList.json().find((t: { id: number }) => t.id === tripId)).toBeUndefined();

    const outsiderGet = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(outsiderGet.statusCode).toBe(403);

    const outsiderSchedule = await app.inject({
      method: 'GET',
      url: `/api/schedule?trip_id=${tripId}`,
      headers: { cookie: outsider.cookie },
    });
    expect(outsiderSchedule.statusCode).toBe(403);

    const outsiderCreateTodo = await app.inject({
      method: 'POST',
      url: '/api/todos',
      headers: { cookie: outsider.cookie },
      payload: { trip_id: tripId, title: 'Fremder Zugriff' },
    });
    expect(outsiderCreateTodo.statusCode).toBe(403);
  });

  it('finds an invitee via autocomplete search and grants access after inviting', async () => {
    const owner = await register('erin', 'erin@example.com');
    const invitee = await register('frank', 'frank@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Gemeinsamer Trip', start_date: '2026-02-01', end_date: '2026-02-10' },
    });
    const tripId = tripRes.json().id;

    const search = await app.inject({
      method: 'GET',
      url: `/api/users/search?q=fran&trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(search.statusCode).toBe(200);
    expect(search.json().some((u: { username: string }) => u.username === 'frank')).toBe(true);

    const invite = await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: invitee.userId },
    });
    expect(invite.statusCode).toBe(201);

    // Nach der Einladung nicht mehr im Suchergebnis (schon Mitglied).
    const searchAfter = await app.inject({
      method: 'GET',
      url: `/api/users/search?q=fran&trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(searchAfter.json().some((u: { username: string }) => u.username === 'frank')).toBe(
      false
    );

    const inviteeList = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie: invitee.cookie },
    });
    expect(inviteeList.json().find((t: { id: number }) => t.id === tripId)).toBeDefined();

    const inviteeSchedule = await app.inject({
      method: 'GET',
      url: `/api/schedule?trip_id=${tripId}`,
      headers: { cookie: invitee.cookie },
    });
    expect(inviteeSchedule.statusCode).toBe(200);

    const members = await app.inject({
      method: 'GET',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
    });
    expect(
      members
        .json()
        .map((u: { username: string }) => u.username)
        .sort()
    ).toEqual(['erin', 'frank']);
  });

  it('escapes SQL wildcards (% and _) literally in user search query', async () => {
    const searcher = await register('grace', 'grace@example.com');
    await register('user%test', 'usertest1@example.com');
    await register('user_test', 'usertest2@example.com');
    await register('userXtest', 'usertest3@example.com');

    const searchPercent = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=user%25t',
      headers: { cookie: searcher.cookie },
    });
    expect(searchPercent.statusCode).toBe(200);
    const resultsPercent = searchPercent.json();
    expect(resultsPercent.length).toBe(1);
    expect(resultsPercent[0].username).toBe('user%test');

    const searchUnderscore = await app.inject({
      method: 'GET',
      url: '/api/users/search?q=user_t',
      headers: { cookie: searcher.cookie },
    });
    expect(searchUnderscore.statusCode).toBe(200);
    const resultsUnderscore = searchUnderscore.json();
    expect(resultsUnderscore.length).toBe(1);
    expect(resultsUnderscore[0].username).toBe('user_test');
  });
});
