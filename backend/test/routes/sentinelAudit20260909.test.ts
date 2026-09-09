import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';
import { isSafeUrl, resolveLatLng, fetchPlacePreview } from '../../src/utils/mapsLink.js';
import { db } from '../../src/db/index.js';

describe('Sentinel Security Audit (2026-09-09) - Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
  });

  describe('1. Restricted User Mode Protection', () => {
    it('blocks restricted users from uploading images via POST /images', async () => {
      const uname = `restr_img_${Date.now()}`;
      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: uname,
          email: `${uname}@example.com`,
          password: 'Password123!',
        },
      });
      expect(regRes.statusCode).toBe(201);
      const userId = regRes.json().id as number;

      const setCookie = regRes.headers['set-cookie'];
      const rawCookie = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
      const cookie = rawCookie.split(';')[0];

      // Set user to restricted in DB
      db.prepare('UPDATE users SET is_restricted = 1 WHERE id = ?').run(userId);

      const res = await app.inject({
        method: 'POST',
        url: '/api/images',
        headers: { cookie },
        payload: {
          data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Eingeschränkter Modus');
    });
  });

  describe('2. SSRF Protection in Maps Utilities', () => {
    it('rejects loopback, internal IPs, non-http schemes and malformed URLs in isSafeUrl', () => {
      expect(isSafeUrl('http://localhost')).toBe(false);
      expect(isSafeUrl('http://127.0.0.1')).toBe(false);
      expect(isSafeUrl('http://127.0.0.1:3000/api')).toBe(false);
      expect(isSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
      expect(isSafeUrl('http://10.0.0.1')).toBe(false);
      expect(isSafeUrl('http://192.168.1.1')).toBe(false);
      expect(isSafeUrl('http://172.16.0.1')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('gopher://localhost:11211')).toBe(false);

      expect(isSafeUrl('https://maps.google.com/?q=48.1,16.2')).toBe(true);
      expect(isSafeUrl('https://maps.app.goo.gl/abc123xyz')).toBe(true);
    });

    it('returns null for internal/loopback links in resolveLatLng and fetchPlacePreview without fetching', async () => {
      const resolved = await resolveLatLng('http://127.0.0.1:8080/secret');
      expect(resolved).toBeNull();

      const preview = await fetchPlacePreview('http://169.254.169.254/latest/meta-data');
      expect(preview).toEqual({ name: null, imageUrl: null });
    });
  });
});
