import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Backup Admin restrictions (#224)', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');

    db.prepare('INSERT INTO users (username, email, password_hash, avatar, is_admin) VALUES (?, ?, ?, ?, 1)').run(
      'admin_bk',
      'admin_bk@example.com',
      bcrypt.hashSync('adminpass', 10),
      '👑',
    );

    db.prepare('INSERT INTO users (username, email, password_hash, avatar, is_admin) VALUES (?, ?, ?, ?, 0)').run(
      'user_bk',
      'user_bk@example.com',
      bcrypt.hashSync('userpass', 10),
      '🧑',
    );

    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin_bk', password: 'adminpass' },
    });
    adminCookie = String(loginAdmin.headers['set-cookie']);

    const loginUser = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'user_bk', password: 'userpass' },
    });
    userCookie = String(loginUser.headers['set-cookie']);
  });

  it('rejects GET /backup/export for non-admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/backup/export',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('Administrator:innen');
  });

  it('allows GET /backup/export for admin user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/backup/export',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('rejects POST /backup/import for non-admin user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/backup/import',
      headers: { cookie: userCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toContain('Administrator:innen');
  });
});
