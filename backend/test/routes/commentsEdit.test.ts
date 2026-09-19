import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('comment editing and authorization routes', () => {
  let app: FastifyInstance;
  let aliceCookie: string;
  let bobCookie: string;
  let tripId: number;
  let bobId: number;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;

    const hash = bcrypt.hashSync('pass123', 10);
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('alice', hash, '👩');

    const bobRes = built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('bob', hash, '👨');
    bobId = Number(bobRes.lastInsertRowid);

    const aliceLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'pass123' },
    });
    const aliceSetCookie = aliceLogin.headers['set-cookie'];
    aliceCookie = Array.isArray(aliceSetCookie)
      ? aliceSetCookie.join('; ')
      : String(aliceSetCookie);

    const bobLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'bob', password: 'pass123' },
    });
    const bobSetCookie = bobLogin.headers['set-cookie'];
    bobCookie = Array.isArray(bobSetCookie) ? bobSetCookie.join('; ') : String(bobSetCookie);

    // Alice creates trip
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: aliceCookie },
      payload: { name: 'Comment-Trip', start_date: '2026-06-01', end_date: '2026-06-10' },
    });
    tripId = tripRes.json().id;

    // Add Bob to trip members
    built.db
      .prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)')
      .run(tripId, bobId, new Date().toISOString());
  });

  describe('notes comments', () => {
    let noteId: number;
    let commentId: number;

    it('creates a note and a comment', async () => {
      const noteRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Notiz', content: 'Inhalt' },
      });
      noteId = noteRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/notes/${noteId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Erster Kommentar' },
      });
      expect(commentRes.statusCode).toBe(201);
      commentId = commentRes.json().id;
    });

    it('allows author to edit their comment and sets updated_at', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/notes/comments/${commentId}`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Bearbeiteter Kommentar' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('Bearbeiteter Kommentar');
      expect(body.updated_at).toBeTruthy();
    });

    it('rejects empty content with 400', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/notes/comments/${commentId}`,
        headers: { cookie: aliceCookie },
        payload: { content: '   ' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('forbids another user from editing the comment (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/notes/comments/${commentId}`,
        headers: { cookie: bobCookie },
        payload: { content: 'Bobs Versuch' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('spots comments', () => {
    let spotId: number;
    let commentId: number;

    it('creates a spot and a comment', async () => {
      const spotRes = await app.inject({
        method: 'POST',
        url: '/api/spots',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Spot', category: 'sights' },
      });
      spotId = spotRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/spots/${spotId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Spot Kommentar' },
      });
      expect(commentRes.statusCode).toBe(201);
      commentId = commentRes.json().id;
    });

    it('allows author to edit their spot comment', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/spots/comments/${commentId}`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Spot Kommentar aktualisiert' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('Spot Kommentar aktualisiert');
      expect(body.updated_at).toBeTruthy();
    });

    it('forbids another user from editing the spot comment (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/spots/comments/${commentId}`,
        headers: { cookie: bobCookie },
        payload: { content: 'Bobs Spot Versuch' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('ideas comments', () => {
    let ideaId: number;
    let commentId: number;

    it('creates an idea and a comment', async () => {
      const ideaRes = await app.inject({
        method: 'POST',
        url: '/api/ideas',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Ausflug' },
      });
      ideaId = ideaRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/ideas/${ideaId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Ausflug Kommentar' },
      });
      expect(commentRes.statusCode).toBe(201);
      commentId = commentRes.json().id;
    });

    it('allows author to edit their idea comment', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/ideas/comments/${commentId}`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Ausflug Kommentar aktualisiert' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('Ausflug Kommentar aktualisiert');
      expect(body.updated_at).toBeTruthy();
    });

    it('forbids another user from editing the idea comment (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/ideas/comments/${commentId}`,
        headers: { cookie: bobCookie },
        payload: { content: 'Bobs Ausflug Versuch' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('diary comments', () => {
    let entryId: number;
    let commentId: number;

    it('creates a diary entry and a comment', async () => {
      const diaryRes = await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, date: '2026-06-02', content: 'Tag 1' },
      });
      expect(diaryRes.statusCode).toBe(201);
      entryId = diaryRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/diary/${entryId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Tagebuch Kommentar' },
      });
      expect(commentRes.statusCode).toBe(201);
      commentId = commentRes.json().id;
    });

    it('allows author to edit their diary comment', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/diary/comments/${commentId}`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Tagebuch Kommentar aktualisiert' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.content).toBe('Tagebuch Kommentar aktualisiert');
      expect(body.updated_at).toBeTruthy();
    });

    it('forbids another user from editing the diary comment (403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/diary/comments/${commentId}`,
        headers: { cookie: bobCookie },
        payload: { content: 'Bobs Tagebuch Versuch' },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
