import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Sentinel Security Audit Verification Suite', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  async function registerUser(username: string, email: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username, email, password: 'SecurePassword123!' },
    });
    const setCookie = res.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    return { res, cookie, userId: res.json().id as number };
  }

  describe('1. Auth & IDOR Access Audit', () => {
    it('prevents non-members from accessing trip resources across domain endpoints', async () => {
      const owner = await registerUser('owner1', 'owner1@example.com');
      const attacker = await registerUser('attacker1', 'attacker1@example.com');

      // Create a trip owned by owner1
      const tripRes = await app.inject({
        method: 'POST',
        url: '/api/trips',
        headers: { cookie: owner.cookie },
        payload: { name: 'Owner Secret Trip', start_date: '2026-05-01', end_date: '2026-05-10' },
      });
      const tripId = tripRes.json().id;

      // Endpoints to check for IDOR (403 expected)
      const endpoints = [
        { method: 'GET' as const, url: `/api/trips/${tripId}` },
        { method: 'GET' as const, url: `/api/schedule?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/packing?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/notes?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/budget?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/spots?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/diary?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/ideas?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/todos?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/shopping?trip_id=${tripId}` },
        { method: 'GET' as const, url: `/api/tracks?trip_id=${tripId}` },
      ];

      for (const ep of endpoints) {
        const res = await app.inject({
          method: ep.method,
          url: ep.url,
          headers: { cookie: attacker.cookie },
        });
        expect(res.statusCode, `Attacker should be forbidden on ${ep.url}`).toBe(403);
      }
    });
  });

  describe('2. Injection & Query Parameter Safety Audit', () => {
    it('safely handles SQL injection payloads in user input fields without error or leakage', async () => {
      const user = await registerUser('sqltester', 'sql@example.com');

      const sqliPayloads = ["' OR '1'='1", "'; DROP TABLE users; --", "1' UNION SELECT 1,2,3--"];

      for (const payload of sqliPayloads) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/users/search?q=${encodeURIComponent(payload)}`,
          headers: { cookie: user.cookie },
        });

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.json())).toBe(true);
      }
    });
  });

  describe('3. Error Leakage & Data Privacy Audit', () => {
    it('does not leak internal stack traces or internal server error details to clients on invalid requests', async () => {
      const user = await registerUser('errtester', 'err@example.com');

      const res = await app.inject({
        method: 'GET',
        url: '/api/trips/not-an-integer-id',
        headers: { cookie: user.cookie },
      });

      // Should respond with a client/access error and not leak stack trace or raw SQL errors
      expect([400, 403, 404]).toContain(res.statusCode);
      const responseText = res.payload;
      expect(responseText).not.toContain('at ');
      expect(responseText).not.toContain('SqliteError');
    });
  });
});
