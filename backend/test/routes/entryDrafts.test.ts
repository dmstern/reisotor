import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für #89: ein per Dialog-Schließen (ohne "Hinzufügen"/"Eintragen") gesicherter
// Entwurf landet als echte, is_draft:true-markierte Notiz/Tagebucheintrag - sichtbar/weiterbearbeitbar
// nur für die anlegende Person (nie für andere Trip-Mitglieder, wie der bisherige `drafts`-
// Mechanismus), bis er per is_draft:false explizit veröffentlicht wird.
describe('entry-level drafts (notes/diary, #89)', () => {
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

  async function makeSharedTrip(ownerCookie: string, memberUserId: number, name: string) {
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: ownerCookie },
      payload: { name, start_date: '2026-07-01', end_date: '2026-07-10' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: ownerCookie },
      payload: { user_id: memberUserId },
    });
    return tripId;
  }

  it('note draft is hidden from other trip members, editable/publishable by its author', async () => {
    const owner = await register('victor', 'victor@example.com');
    const member = await register('wanda', 'wanda@example.com');
    const tripId = await makeSharedTrip(owner.cookie, member.userId, 'Notiz-Entwurf-Trip');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/notes',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        content: '<p>Halbfertig</p>',
        content_format: 'html',
        is_draft: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const noteId = createRes.json().id;
    expect(createRes.json().is_draft).toBe(1);

    const listAsMember = await app.inject({
      method: 'GET',
      url: `/api/notes?trip_id=${tripId}`,
      headers: { cookie: member.cookie },
    });
    expect(listAsMember.json()).toEqual([]);

    const listAsOwner = await app.inject({
      method: 'GET',
      url: `/api/notes?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(listAsOwner.json()).toHaveLength(1);

    // Ein anderes Mitglied darf den fremden Entwurf weder bearbeiten noch löschen.
    const memberEdit = await app.inject({
      method: 'PUT',
      url: `/api/notes/${noteId}`,
      headers: { cookie: member.cookie },
      payload: { content: '<p>Fremdzugriff</p>', content_format: 'html', is_draft: true },
    });
    expect(memberEdit.statusCode).toBe(403);

    // Veröffentlichen (is_draft:false) macht ihn für alle Mitglieder sichtbar.
    const publish = await app.inject({
      method: 'PUT',
      url: `/api/notes/${noteId}`,
      headers: { cookie: owner.cookie },
      payload: { content: '<p>Fertig</p>', content_format: 'html', is_draft: false },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().is_draft).toBe(0);

    const listAsMemberAfter = await app.inject({
      method: 'GET',
      url: `/api/notes?trip_id=${tripId}`,
      headers: { cookie: member.cookie },
    });
    expect(listAsMemberAfter.json()).toHaveLength(1);
  });

  it('diary entry draft is hidden from other trip members, editable/publishable by its author', async () => {
    const owner = await register('xenia', 'xenia@example.com');
    const member = await register('yannick', 'yannick@example.com');
    const tripId = await makeSharedTrip(owner.cookie, member.userId, 'Tagebuch-Entwurf-Trip');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/diary',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        content: '<p>Noch nicht fertig</p>',
        content_format: 'html',
        date: '2026-07-02',
        is_draft: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const entryId = createRes.json().id;
    expect(createRes.json().is_draft).toBe(1);

    const listAsMember = await app.inject({
      method: 'GET',
      url: `/api/diary?trip_id=${tripId}`,
      headers: { cookie: member.cookie },
    });
    expect(listAsMember.json()).toEqual([]);

    const memberEdit = await app.inject({
      method: 'PUT',
      url: `/api/diary/${entryId}`,
      headers: { cookie: member.cookie },
      payload: { content: '<p>Fremdzugriff</p>', content_format: 'html', is_draft: true },
    });
    expect(memberEdit.statusCode).toBe(403);

    const publish = await app.inject({
      method: 'PUT',
      url: `/api/diary/${entryId}`,
      headers: { cookie: owner.cookie },
      payload: { content: '<p>Fertig geschrieben</p>', content_format: 'html', is_draft: false },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().is_draft).toBe(0);

    const listAsMemberAfter = await app.inject({
      method: 'GET',
      url: `/api/diary?trip_id=${tripId}`,
      headers: { cookie: member.cookie },
    });
    expect(listAsMemberAfter.json()).toHaveLength(1);

    // Veröffentlichte Einträge dürfen (#93) wieder von jedem Trip-Mitglied bearbeitet werden.
    const memberEditsPublished = await app.inject({
      method: 'PUT',
      url: `/api/diary/${entryId}`,
      headers: { cookie: member.cookie },
      payload: { content: '<p>Datum korrigiert</p>', content_format: 'html', date: '2026-07-03' },
    });
    expect(memberEditsPublished.statusCode).toBe(200);
  });
});
