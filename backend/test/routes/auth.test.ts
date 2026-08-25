import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('auth routes + requireAuth gating', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');
    db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(
      'testuser',
      bcrypt.hashSync('correct-horse', 10),
      '🧪'
    );
  });

  it('logs in with correct credentials and sets a session cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'correct-horse' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ username: 'testuser', avatar: '🧪' });
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects an incorrect password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Ungültige Anmeldedaten' });
  });

  it('rejects a login with missing fields', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a protected route without a session cookie', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/trips' });
    expect(res.statusCode).toBe(401);
  });

  it('allows a protected route with a valid session cookie', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'testuser', password: 'correct-horse' },
    });
    const cookie = login.headers['set-cookie'];
    expect(cookie).toBeDefined();

    const res = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: { cookie: Array.isArray(cookie) ? cookie.join('; ') : String(cookie) },
    });
    expect(res.statusCode).toBe(200);
  });
});
