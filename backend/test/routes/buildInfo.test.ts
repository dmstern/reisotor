import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('buildInfo routes', () => {
  let app: FastifyInstance;
  let cookie: string;
  const originalMinClientVersion = process.env.MIN_CLIENT_VERSION;

  beforeAll(async () => {
    const built = await buildTestApp();
    app = built.app;
    built.db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('builduser', bcrypt.hashSync('correct-horse', 10), '🧪');

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'builduser', password: 'correct-horse' },
    });
    const setCookie = login.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
  });

  afterEach(() => {
    if (originalMinClientVersion === undefined) {
      delete process.env.MIN_CLIENT_VERSION;
    } else {
      process.env.MIN_CLIENT_VERSION = originalMinClientVersion;
    }
  });

  it('returns build info including minClientVersion when logged in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/build-info',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('minClientVersion');
    expect(body).toHaveProperty('environment');
    expect(body).toHaveProperty('repoUrl');
    expect(body).toHaveProperty('hostingLocation');
  });

  it('returns build info when logged out (public endpoint)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/build-info',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('minClientVersion');
    expect(body).toHaveProperty('environment');
    expect(body).toHaveProperty('repoUrl');
    expect(body).toHaveProperty('hostingLocation');
  });

  it('returns MIN_CLIENT_VERSION env override in /api/build-info and rejects outdated clients with 426', async () => {
    process.env.MIN_CLIENT_VERSION = '2.5.0';

    const buildInfoRes = await app.inject({
      method: 'GET',
      url: '/api/build-info',
      headers: { 'x-client-version': '1.0.0' },
    });
    expect(buildInfoRes.statusCode).toBe(200);
    expect(buildInfoRes.json().minClientVersion).toBe('2.5.0');

    const legalRes = await app.inject({
      method: 'GET',
      url: '/api/legal?source=footer',
      headers: { 'x-client-version': '1.0.0' },
    });
    expect(legalRes.statusCode).toBe(200);

    const outdatedProtectedRes = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie, 'x-client-version': '2.4.9' },
    });
    expect(outdatedProtectedRes.statusCode).toBe(426);
    expect(outdatedProtectedRes.json()).toMatchObject({
      code: 'CLIENT_UPDATE_REQUIRED',
      minClientVersion: '2.5.0',
    });

    const compatibleProtectedRes = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie, 'x-client-version': '2.5.0-dev' },
    });
    expect(compatibleProtectedRes.statusCode).toBe(200);

    const noHeaderRes = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie },
    });
    expect(noHeaderRes.statusCode).toBe(200);
  });

  it('returns changelog with optional groups if available', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/build-info',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    if (body.changelog) {
      expect(body.changelog).toHaveProperty('version');
      expect(body.changelog).toHaveProperty('notes');
      expect(Array.isArray(body.changelog.notes)).toBe(true);

      if (body.changelog.groups) {
        expect(Array.isArray(body.changelog.groups)).toBe(true);

        for (const group of body.changelog.groups) {
          expect(group).toHaveProperty('title');
          expect(group).toHaveProperty('notes');
          expect(Array.isArray(group.notes)).toBe(true);
        }
      }

      if (body.changelog.baseRelease) {
        expect(body.changelog.baseRelease).toHaveProperty('version');
        expect(body.changelog.baseRelease).toHaveProperty('notes');
        expect(Array.isArray(body.changelog.baseRelease.notes)).toBe(true);
      }
    }
  });
});
