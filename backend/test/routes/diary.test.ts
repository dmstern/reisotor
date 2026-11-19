import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { buildTestApp } from '../helpers/buildTestApp.js';

// Regressionsnetz für #93: Tagebucheinträge dürfen seitdem von jedem Trip-Mitglied bearbeitet
// werden (z. B. um ein falsches Datum zu korrigieren), nicht mehr nur von der Autorin/dem Autor.
// Wer nicht selbst author_id ist, landet zusätzlich in editor_ids ("bearbeitet von", DiaryView.vue).
// Löschen bleibt bewusst author-only, siehe routes/diary.ts.
describe('diary co-editing (#93)', () => {
  let app: FastifyInstance;
  let db: Database.Database;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
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

  it('filters out null/falsy image values safely on create and read (#603)', async () => {
    const user = await register('filteruser', 'diary-images-filter@example.com');
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: user.cookie },
      payload: { name: 'Filter Images Trip', start_date: '2026-03-01', end_date: '2026-03-10' },
    });
    const tripId = tripRes.json().id;

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/diary',
      headers: { cookie: user.cookie },
      payload: {
        trip_id: tripId,
        content: '<p>Tagebuch mit null-Bildern</p>',
        content_format: 'html',
        date: '2026-04-02',
        images: [
          null,
          { url: '/api/uploads/valid.png', original_name: 'valid.png' },
          undefined,
          '',
        ],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json();
    expect(created.images).toEqual([{ url: '/api/uploads/valid.png', original_name: 'valid.png' }]);

    // Direkt in DB [null] schreiben, um Altdaten/Korruption zu simulieren
    db.prepare('UPDATE diary_entries SET images = ? WHERE id = ?').run(
      '[null, "https://example.com/test.jpg"]',
      created.id
    );

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/diary?trip_id=${tripId}`,
      headers: { cookie: user.cookie },
    });
    expect(getRes.statusCode).toBe(200);
    const entries = getRes.json();
    expect(entries[0].images).toEqual(['https://example.com/test.jpg']);
  });
});

describe('bidirectional diary linking for ideas and spots', () => {
  let app: FastifyInstance;
  let db: Database.Database;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    db = built.db;
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

  it('links/unlinks published diary entries via POST/PUT /ideas while preserving drafts and omitted diary_ids', async () => {
    const owner = await register('link_owner', 'link_owner@example.com');
    const member = await register('link_member', 'link_member@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Link-Reise', start_date: '2026-05-01', end_date: '2026-05-10' },
    });
    const tripId = tripRes.json().id as number;

    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    const otherTripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Andere Reise', start_date: '2026-06-01', end_date: '2026-06-05' },
    });
    const otherTripId = otherTripRes.json().id as number;

    const pub1 = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Tag 1',
          content: '<p>Veröffentlicht 1</p>',
          content_format: 'html',
          date: '2026-05-02',
          is_draft: false,
        },
      })
    ).json().id as number;

    const pub2 = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Tag 2',
          content: '<p>Veröffentlicht 2</p>',
          content_format: 'html',
          date: '2026-05-03',
          is_draft: false,
        },
      })
    ).json().id as number;

    const memberDraft = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: member.cookie },
        payload: {
          trip_id: tripId,
          title: 'Privater Entwurf',
          content: '<p>Geheim</p>',
          content_format: 'html',
          date: '2026-05-02',
          is_draft: true,
        },
      })
    ).json().id as number;

    const otherTripEntry = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: otherTripId,
          title: 'Fremder Trip',
          content: '<p>Anderer Urlaub</p>',
          content_format: 'html',
          date: '2026-06-02',
          is_draft: false,
        },
      })
    ).json().id as number;

    // 1. POST /ideas mit diary_ids (inkl. Duplikat, Entwurf und fremder Trip-ID)
    const createIdeaRes = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Küstentour',
        diary_ids: [pub1, pub1, memberDraft, otherTripEntry],
      },
    });
    expect(createIdeaRes.statusCode).toBe(201);
    const ideaId = createIdeaRes.json().id as number;

    // Entwurf zusätzlich direkt mit der Tour verknüpfen (z. B. durch den Entwurfs-Autor)
    db.prepare('INSERT INTO diary_excursions (entry_id, idea_id) VALUES (?, ?)').run(
      memberDraft,
      ideaId
    );

    let diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; excursion_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.excursion_ids).toEqual([ideaId]);
    expect(diaryList.find((entry) => entry.id === pub2)?.excursion_ids).toEqual([]);

    const otherList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${otherTripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; excursion_ids: number[] }>;
    expect(otherList.find((entry) => entry.id === otherTripEntry)?.excursion_ids).toEqual([]);

    // 2. PUT /ideas/:id ohne diary_ids erhält bestehende Verknüpfung
    const updateOmittedRes = await app.inject({
      method: 'PUT',
      url: `/api/ideas/${ideaId}`,
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Küstentour Umbenannt',
      },
    });
    expect(updateOmittedRes.statusCode).toBe(200);

    diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; excursion_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.excursion_ids).toEqual([ideaId]);

    // 3. PUT /ideas/:id mit [pub2] entfernt pub1, fügt pub2 hinzu und lässt memberDraft unberührt
    const updateLinksRes = await app.inject({
      method: 'PUT',
      url: `/api/ideas/${ideaId}`,
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Küstentour Umbenannt',
        diary_ids: [pub2],
      },
    });
    expect(updateLinksRes.statusCode).toBe(200);

    diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; excursion_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.excursion_ids).toEqual([]);
    expect(diaryList.find((entry) => entry.id === pub2)?.excursion_ids).toEqual([ideaId]);

    const draftRow = db
      .prepare('SELECT entry_id FROM diary_excursions WHERE entry_id = ? AND idea_id = ?')
      .get(memberDraft, ideaId);
    expect(draftRow).toEqual({ entry_id: memberDraft });
  });

  it('links/unlinks published diary entries via POST/PUT /spots while preserving drafts and omitted diary_ids', async () => {
    const owner = await register('spot_link_owner', 'spot_link_owner@example.com');
    const member = await register('spot_link_member', 'spot_link_member@example.com');

    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: owner.cookie },
      payload: { name: 'Spot-Link-Reise', start_date: '2026-07-01', end_date: '2026-07-10' },
    });
    const tripId = tripRes.json().id as number;

    await app.inject({
      method: 'POST',
      url: `/api/trips/${tripId}/members`,
      headers: { cookie: owner.cookie },
      payload: { user_id: member.userId },
    });

    const pub1 = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Spot-Tag 1',
          content: '<p>Veröffentlicht</p>',
          content_format: 'html',
          date: '2026-07-02',
          is_draft: false,
        },
      })
    ).json().id as number;

    const pub2 = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: owner.cookie },
        payload: {
          trip_id: tripId,
          title: 'Spot-Tag 2',
          content: '<p>Veröffentlicht 2</p>',
          content_format: 'html',
          date: '2026-07-03',
          is_draft: false,
        },
      })
    ).json().id as number;

    const memberDraft = (
      await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: member.cookie },
        payload: {
          trip_id: tripId,
          title: 'Spot Entwurf',
          content: '<p>Privat</p>',
          content_format: 'html',
          date: '2026-07-02',
          is_draft: true,
        },
      })
    ).json().id as number;

    // 1. POST /spots mit diary_ids
    const createSpotRes = await app.inject({
      method: 'POST',
      url: '/api/spots',
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Aussichtspunkt',
        category: 'Aussichtspunkt',
        diary_ids: [pub1, memberDraft],
      },
    });
    expect(createSpotRes.statusCode).toBe(201);
    const spotId = createSpotRes.json().id as number;

    db.prepare('INSERT INTO diary_spots (entry_id, spot_id) VALUES (?, ?)').run(
      memberDraft,
      spotId
    );

    let diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; spot_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.spot_ids).toEqual([spotId]);
    expect(diaryList.find((entry) => entry.id === pub2)?.spot_ids).toEqual([]);

    // 2. PUT /spots/:id ohne diary_ids erhält bestehende Verknüpfung
    const updateOmittedRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${spotId}`,
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Aussichtspunkt Nord',
        category: 'Aussichtspunkt',
      },
    });
    expect(updateOmittedRes.statusCode).toBe(200);

    diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; spot_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.spot_ids).toEqual([spotId]);

    // 3. PUT /spots/:id mit [pub2] aktualisiert Links und lässt memberDraft unberührt
    const updateLinksRes = await app.inject({
      method: 'PUT',
      url: `/api/spots/${spotId}`,
      headers: { cookie: owner.cookie },
      payload: {
        trip_id: tripId,
        title: 'Aussichtspunkt Nord',
        category: 'Aussichtspunkt',
        diary_ids: [pub2],
      },
    });
    expect(updateLinksRes.statusCode).toBe(200);

    diaryList = (
      await app.inject({
        method: 'GET',
        url: `/api/diary?trip_id=${tripId}`,
        headers: { cookie: owner.cookie },
      })
    ).json() as Array<{ id: number; spot_ids: number[] }>;
    expect(diaryList.find((entry) => entry.id === pub1)?.spot_ids).toEqual([]);
    expect(diaryList.find((entry) => entry.id === pub2)?.spot_ids).toEqual([spotId]);

    const draftRow = db
      .prepare('SELECT entry_id FROM diary_spots WHERE entry_id = ? AND spot_id = ?')
      .get(memberDraft, spotId);
    expect(draftRow).toEqual({ entry_id: memberDraft });

    const diaryActivities = db
      .prepare(
        "SELECT entity_id FROM trip_activity WHERE trip_id = ? AND domain = 'diary' AND action = 'updated' ORDER BY id ASC"
      )
      .all(tripId) as Array<{ entity_id: number }>;
    expect(diaryActivities.map((row) => row.entity_id)).toEqual([pub1, pub1, pub2]);
  });
});
