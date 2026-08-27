import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('User App Settings API', () => {
  let app: FastifyInstance;
  let loginCookie: string;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'settingsuser',
      bcrypt.hashSync('settingspass', 10),
      '⚙️'
    );

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'settingsuser', password: 'settingspass' },
    });
    const cookieHeader = loginRes.headers['set-cookie'];
    loginCookie = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : String(cookieHeader);
  });

  it('returns empty object when no app settings are saved', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users/me/app-settings',
      headers: { cookie: loginCookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({});
  });

  it('saves and retrieves app settings for current user', async () => {
    const payload = {
      theme: 'dark',
      primaryColor: '#2563eb',
      borderWidth: 2,
      glassStyle: 'frosted',
      glassOpacity: 80,
      glassBlur: 24,
      navPosition: { desktop: 'top', mobile: 'bottom' },
    };

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/users/me/app-settings',
      headers: { cookie: loginCookie },
      payload: { settings: payload },
    });

    expect(putRes.statusCode).toBe(200);
    expect(putRes.json()).toEqual(payload);

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/users/me/app-settings',
      headers: { cookie: loginCookie },
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toEqual(payload);
  });

  it('rejects PUT request without settings object', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/users/me/app-settings',
      headers: { cookie: loginCookie },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'Einstellungen erforderlich' });
  });

  it('rejects unauthenticated requests', async () => {
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/users/me/app-settings',
    });
    expect(getRes.statusCode).toBe(401);

    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/users/me/app-settings',
      payload: { settings: { theme: 'dark' } },
    });
    expect(putRes.statusCode).toBe(401);
  });
});
