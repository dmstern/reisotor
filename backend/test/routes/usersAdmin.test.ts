import { beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Admin User Management routes (#224)', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;
  let adminId: number;
  let regularUserId: number;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');

    // Admin-Nutzer anlegen
    const adminRes = db
      .prepare('INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 1, 0)')
      .run('admin_user', 'admin@example.com', bcrypt.hashSync('adminpass', 10), '👑');
    adminId = adminRes.lastInsertRowid as number;

    // Normalen Nutzer anlegen
    const userRes = db
      .prepare('INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 0, 0)')
      .run('normal_user', 'normal@example.com', bcrypt.hashSync('userpass', 10), '🧑');
    regularUserId = userRes.lastInsertRowid as number;

    // Sessions erzeugen
    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin_user', password: 'adminpass' },
    });
    adminCookie = String(loginAdmin.headers['set-cookie']);

    const loginUser = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'normal_user', password: 'userpass' },
    });
    userCookie = String(loginUser.headers['set-cookie']);
  });

  it('allows admin to fetch full user list with email and flags', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const users = res.json();
    expect(Array.isArray(users)).toBe(true);
    expect(users.find((u: any) => u.username === 'admin_user')).toMatchObject({
      is_admin: true,
      email: 'admin@example.com',
    });
  });

  it('returns basic user list for non-admin without email or admin status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(200);
    const users = res.json();
    expect(users[0]).toHaveProperty('username');
    expect(users[0]).not.toHaveProperty('email');
    expect(users[0]).not.toHaveProperty('is_admin');
  });

  it('rejects POST /users for non-admin users', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: userCookie },
      payload: { username: 'newuser', password: 'password123' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows admin to create a new user with must_change_password=1', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: {
        username: 'created_by_admin',
        email: 'created@example.com',
        password: 'initialpass123',
        is_admin: false,
      },
    });
    expect(res.statusCode).toBe(201);
    const data = res.json();
    expect(data).toMatchObject({
      username: 'created_by_admin',
      email: 'created@example.com',
      is_admin: false,
      must_change_password: true,
    });
  });

  it('allows admin to promote another user to admin', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${regularUserId}/admin`,
      headers: { cookie: adminCookie },
      payload: { is_admin: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().is_admin).toBe(true);
  });

  it('prevents sole admin from demoting themselves', async () => {
    // Revert regular user admin status first
    await app.inject({
      method: 'PUT',
      url: `/api/users/${regularUserId}/admin`,
      headers: { cookie: adminCookie },
      payload: { is_admin: false },
    });

    const res = await app.inject({
      method: 'PUT',
      url: `/api/users/${adminId}/admin`,
      headers: { cookie: adminCookie },
      payload: { is_admin: false },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('letzte Administrator');
  });

  it('clears must_change_password when updating password', async () => {
    // Login as created_by_admin
    const loginCreated = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'created_by_admin', password: 'initialpass123' },
    });
    expect(loginCreated.json().must_change_password).toBe(true);
    const createdCookie = String(loginCreated.headers['set-cookie']);

    // Change password
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/users/me/password',
      headers: { cookie: createdCookie },
      payload: { currentPassword: 'initialpass123', newPassword: 'newsecurepassword' },
    });
    expect(updateRes.statusCode).toBe(204);

    // Verify /auth/me now has must_change_password = false
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: createdCookie },
    });
    expect(meRes.json().must_change_password).toBe(false);
  });

  it('allows admin to delete a user with existing foreign key references', async () => {
    const { db } = await import('../../src/db/index.js');

    // Create user with references
    const res = db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('referenced_user', bcrypt.hashSync('pass', 10), '👤');
    const targetId = res.lastInsertRowid as number;

    // Create dummy trip & references
    const tripRes = db.prepare('INSERT INTO trips (name, start_date, end_date) VALUES (?, ?, ?)').run('Test Trip FK', '2026-08-01', '2026-08-10');
    const tripId = tripRes.lastInsertRowid as number;

    db.prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(tripId, targetId, '2026-08-01T00:00:00Z');
    db.prepare('INSERT INTO packing_items (label, owner_id) VALUES (?, ?)').run('Shirt', targetId);

    // Delete user
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/users/${targetId}`,
      headers: { cookie: adminCookie },
    });
    expect(delRes.statusCode).toBe(204);

    // Verify foreign key references were cleaned up/set to NULL
    const member = db.prepare('SELECT * FROM trip_members WHERE user_id = ?').get(targetId);
    expect(member).toBeUndefined();
    const item = db.prepare('SELECT owner_id FROM packing_items WHERE label = ?').get('Shirt') as { owner_id: number | null };
    expect(item.owner_id).toBeNull();
  });

  it('allows admin to delete a user, but not themselves', async () => {
    // Delete self attempt
    const selfDel = await app.inject({
      method: 'DELETE',
      url: `/api/users/${adminId}`,
      headers: { cookie: adminCookie },
    });
    expect(selfDel.statusCode).toBe(400);

    // Delete regular user
    const userDel = await app.inject({
      method: 'DELETE',
      url: `/api/users/${regularUserId}`,
      headers: { cookie: adminCookie },
    });
    expect(userDel.statusCode).toBe(204);
  });
});
