import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('comment liking and authorization routes', () => {
  let app: FastifyInstance;
  let aliceCookie: string;
  let bobCookie: string;
  let eveCookie: string;
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

    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('eve', hash, '🕵️');

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

    const eveLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'eve', password: 'pass123' },
    });
    const eveSetCookie = eveLogin.headers['set-cookie'];
    eveCookie = Array.isArray(eveSetCookie) ? eveSetCookie.join('; ') : String(eveSetCookie);

    // Alice creates trip
    const tripRes = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { cookie: aliceCookie },
      payload: { name: 'Comment-Like-Trip', start_date: '2026-06-01', end_date: '2026-06-10' },
    });
    tripId = tripRes.json().id;

    // Add Bob to trip members
    built.db
      .prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)')
      .run(tripId, bobId, new Date().toISOString());
  });

  describe('notes comment likes', () => {
    let commentId: number;

    beforeAll(async () => {
      const noteRes = await app.inject({
        method: 'POST',
        url: '/api/notes',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Notiz', content: 'Inhalt' },
      });
      const noteId = noteRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/notes/${noteId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Notiz Kommentar' },
      });
      commentId = commentRes.json().id;
      expect(commentRes.json().like_count).toBe(0);
      expect(commentRes.json().liked).toBe(0);
    });

    it('allows toggling like on notes comment and reflects in GET comments', async () => {
      // Alice likes comment
      const likeRes1 = await app.inject({
        method: 'POST',
        url: `/api/notes/comments/${commentId}/like`,
        headers: { cookie: aliceCookie },
      });
      expect(likeRes1.statusCode).toBe(200);
      expect(likeRes1.json()).toEqual({ liked: true, like_count: 1 });

      // Bob likes comment
      const likeRes2 = await app.inject({
        method: 'POST',
        url: `/api/notes/comments/${commentId}/like`,
        headers: { cookie: bobCookie },
      });
      expect(likeRes2.statusCode).toBe(200);
      expect(likeRes2.json()).toEqual({ liked: true, like_count: 2 });

      // Bob fetches comments
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/notes/comments?trip_id=${tripId}`,
        headers: { cookie: bobCookie },
      });
      expect(getRes.statusCode).toBe(200);
      const comment = getRes.json().find((c: { id: number }) => c.id === commentId);
      expect(comment.like_count).toBe(2);
      expect(comment.liked).toBe(1);

      // Bob unlikes comment
      const unlikeRes = await app.inject({
        method: 'POST',
        url: `/api/notes/comments/${commentId}/like`,
        headers: { cookie: bobCookie },
      });
      expect(unlikeRes.statusCode).toBe(200);
      expect(unlikeRes.json()).toEqual({ liked: false, like_count: 1 });

      // Bob fetches comments again
      const getRes2 = await app.inject({
        method: 'GET',
        url: `/api/notes/comments?trip_id=${tripId}`,
        headers: { cookie: bobCookie },
      });
      const commentAfter = getRes2.json().find((c: { id: number }) => c.id === commentId);
      expect(commentAfter.like_count).toBe(1);
      expect(commentAfter.liked).toBe(0);
    });

    it('rejects non-member with 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/notes/comments/${commentId}/like`,
        headers: { cookie: eveCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for unknown comment', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/notes/comments/999999/like',
        headers: { cookie: aliceCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('spots comment likes', () => {
    let commentId: number;

    beforeAll(async () => {
      const spotRes = await app.inject({
        method: 'POST',
        url: '/api/spots',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Spot', category: 'Kultur' },
      });
      const spotId = spotRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/spots/${spotId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Spot Kommentar' },
      });
      commentId = commentRes.json().id;
    });

    it('allows toggling like on spots comment', async () => {
      const likeRes = await app.inject({
        method: 'POST',
        url: `/api/spots/comments/${commentId}/like`,
        headers: { cookie: aliceCookie },
      });
      expect(likeRes.statusCode).toBe(200);
      expect(likeRes.json()).toEqual({ liked: true, like_count: 1 });

      const unlikeRes = await app.inject({
        method: 'POST',
        url: `/api/spots/comments/${commentId}/like`,
        headers: { cookie: aliceCookie },
      });
      expect(unlikeRes.statusCode).toBe(200);
      expect(unlikeRes.json()).toEqual({ liked: false, like_count: 0 });
    });
  });

  describe('ideas comment likes', () => {
    let commentId: number;

    beforeAll(async () => {
      const ideaRes = await app.inject({
        method: 'POST',
        url: '/api/ideas',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, title: 'Tour' },
      });
      const ideaId = ideaRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/ideas/${ideaId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Idea Kommentar' },
      });
      commentId = commentRes.json().id;
    });

    it('allows toggling like on ideas comment', async () => {
      const likeRes = await app.inject({
        method: 'POST',
        url: `/api/ideas/comments/${commentId}/like`,
        headers: { cookie: bobCookie },
      });
      expect(likeRes.statusCode).toBe(200);
      expect(likeRes.json()).toEqual({ liked: true, like_count: 1 });

      const unlikeRes = await app.inject({
        method: 'POST',
        url: `/api/ideas/comments/${commentId}/like`,
        headers: { cookie: bobCookie },
      });
      expect(unlikeRes.statusCode).toBe(200);
      expect(unlikeRes.json()).toEqual({ liked: false, like_count: 0 });
    });
  });

  describe('diary comment likes', () => {
    let commentId: number;

    beforeAll(async () => {
      const entryRes = await app.inject({
        method: 'POST',
        url: '/api/diary',
        headers: { cookie: aliceCookie },
        payload: { trip_id: tripId, content: 'Eintrag' },
      });
      const entryId = entryRes.json().id;

      const commentRes = await app.inject({
        method: 'POST',
        url: `/api/diary/${entryId}/comments`,
        headers: { cookie: aliceCookie },
        payload: { content: 'Diary Kommentar' },
      });
      commentId = commentRes.json().id;
    });

    it('allows toggling like on diary comment', async () => {
      const likeRes = await app.inject({
        method: 'POST',
        url: `/api/diary/comments/${commentId}/like`,
        headers: { cookie: aliceCookie },
      });
      expect(likeRes.statusCode).toBe(200);
      expect(likeRes.json()).toEqual({ liked: true, like_count: 1 });

      const unlikeRes = await app.inject({
        method: 'POST',
        url: `/api/diary/comments/${commentId}/like`,
        headers: { cookie: aliceCookie },
      });
      expect(unlikeRes.statusCode).toBe(200);
      expect(unlikeRes.json()).toEqual({ liked: false, like_count: 0 });
    });
  });
});
