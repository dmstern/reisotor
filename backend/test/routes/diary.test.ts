import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für #93: Tagebucheinträge dürfen seitdem von jedem Trip-Mitglied bearbeitet
// werden (z. B. um ein falsches Datum zu korrigieren), nicht mehr nur von der Autorin/dem Autor.
// Wer nicht selbst author_id ist, landet zusätzlich in editor_ids ("bearbeitet von", DiaryView.vue).
// Löschen bleibt bewusst author-only, siehe routes/diary.ts.
describe('diary co-editing (#93)', () => {
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

  it('lets a fellow trip member edit another member’s diary entry and records them as co-editor', async () => {
    const owner = await register('gina', 'gina@example.com');
    const member = await register('hank', 'hank@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Gemeinsame Reise', start_date: '2026-03-01', end_date: '2026-03-10' },
    });
    const tripId = tripRes.json().id;
    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    const entryRes = await app.inject({
      method: 'POST',
      url: '/api/diary',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        content: '<p>Toller Tag</p>',
        content_format: 'html',
        date: '2026-03-02',
      },
    });
    expect(entryRes.statusCode).toBe(201);
    const entryId = entryRes.json().id;
    expect(entryRes.json().editor_ids).toEqual([]);

    const editRes = await app.inject({
      method: 'PUT',
      url: `/api/diary/${entryId}`,
      headers: { cookie: member.cookie },
      payload: {
        content: '<p>Toller Tag, korrigiertes Datum</p>',
        content_format: 'html',
        date: '2026-03-03',
      },
    });
    expect(editRes.statusCode).toBe(200);
    const edited = editRes.json();
    expect(edited.author_id).toBe(owner.userId);
    expect(edited.date).toBe('2026-03-03');
    expect(edited.editor_ids).toEqual([member.userId]);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/diary?trip_id=${tripId}`,
      headers: { cookie: owner.cookie },
    });
    expect(listRes.json()[0].editor_ids).toEqual([member.userId]);

    // Löschen bleibt author-only.
    const deleteByMember = await app.inject({
      method: 'DELETE',
      url: `/api/diary/${entryId}`,
      headers: { cookie: member.cookie },
    });
    expect(deleteByMember.statusCode).toBe(403);
  });

  it('preserves original filename on upload and supports image objects in diary entries', async () => {
    const user = await register('iris', 'iris@example.com');
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // 1. Upload mit Dateinamen
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/diary/images',
      headers: { cookie: user.cookie },
      payload: {
        data: tinyPng,
        filename: 'mein_urlaub_2026.png',
      },
    });
    expect(uploadRes.statusCode).toBe(201);
    const uploadBody = uploadRes.json();
    expect(uploadBody.url).toMatch(/^\/api\/uploads\/[0-9a-f-]+\.png$/);
    expect(uploadBody.original_name).toBe('mein_urlaub_2026.png');

    // 2. Pfadbereinigung (Sanitization)
    const sanitizedRes = await app.inject({
      method: 'POST',
      url: '/api/diary/images',
      headers: { cookie: user.cookie },
      payload: {
        data: tinyPng,
        filename: '../../secret/path/to/camera_roll.png',
      },
    });
    expect(sanitizedRes.statusCode).toBe(201);
    expect(sanitizedRes.json().original_name).toBe('camera_roll.png');

    // 3. Fallback, falls kein filename übergeben wird
    const fallbackRes = await app.inject({
      method: 'POST',
      url: '/api/diary/images',
      headers: { cookie: user.cookie },
      payload: {
        data: tinyPng,
      },
    });
    expect(fallbackRes.statusCode).toBe(201);
    expect(fallbackRes.json().original_name).toMatch(/^[0-9a-f-]+\.png$/);

    // 4. Tagebucheintrag mit Bildobjekten und Legacy-String-URLs speichern und abrufen
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: user.cookie },
      payload: { name: 'Foto Reise', start_date: '2026-04-01', end_date: '2026-04-05' },
    });
    const tripId = tripRes.json().id;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/diary',
      headers: { cookie: user.cookie },
      payload: {
        trip_id: tripId,
        content: '<p>Tagebuch mit Fotos</p>',
        content_format: 'html',
        date: '2026-04-01',
        images: [
          { url: uploadBody.url, original_name: 'mein_urlaub_2026.png' },
          '/api/uploads/legacy_string_url.jpg',
        ],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdEntry = createRes.json();
    expect(createdEntry.images).toEqual([
      { url: uploadBody.url, original_name: 'mein_urlaub_2026.png' },
      '/api/uploads/legacy_string_url.jpg',
    ]);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/diary?trip_id=${tripId}`,
      headers: { cookie: user.cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const entries = getRes.json();
    expect(entries[0].images).toEqual([
      { url: uploadBody.url, original_name: 'mein_urlaub_2026.png' },
      '/api/uploads/legacy_string_url.jpg',
    ]);
  });
});
