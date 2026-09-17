import { beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('buildInfo routes', () => {
  let app: FastifyInstance;
  let cookie: string;

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

  it('returns build info when logged in', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/build-info',
      headers: { cookie },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('environment');
    expect(body).toHaveProperty('repoUrl');
    expect(body).toHaveProperty('hostingLocation');
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
    }
  });
});
