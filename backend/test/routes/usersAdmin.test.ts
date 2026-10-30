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
      .prepare(
        'INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 1, 0)'
      )
      .run('admin_user', 'admin@example.com', bcrypt.hashSync('adminpass', 10), '👑');
    adminId = adminRes.lastInsertRowid as number;

    // Normalen Nutzer anlegen
    const userRes = db
      .prepare(
        'INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 0, 0)'
      )
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
    expect(users.find((u: { username: string }) => u.username === 'admin_user')).toMatchObject({
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

  it('allows admin to create user with specific role (restricted, plus, admin)', async () => {
    // Restricted role
    const resRestricted = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: {
        username: 'user_restricted',
        email: 'user_restricted@example.com',
        password: 'initialpass123',
        role: 'restricted',
      },
    });
    expect(resRestricted.statusCode).toBe(201);
    expect(resRestricted.json()).toMatchObject({
      username: 'user_restricted',
      is_restricted: true,
      restricted: true,
      is_admin: false,
    });

    // Plus role
    const resPlus = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: {
        username: 'user_plus',
        email: 'user_plus@example.com',
        password: 'initialpass123',
        role: 'plus',
      },
    });
    expect(resPlus.statusCode).toBe(201);
    expect(resPlus.json()).toMatchObject({
      username: 'user_plus',
      is_restricted: false,
      restricted: false,
      is_admin: false,
    });

    // Reject invalid role
    const resInvalid = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: { cookie: adminCookie },
      payload: {
        username: 'user_invalid',
        password: 'initialpass123',
        role: 'invalid_role',
      },
    });
    expect(resInvalid.statusCode).toBe(400);
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
    const tripRes = db
      .prepare('INSERT INTO trips (name, start_date, end_date) VALUES (?, ?, ?)')
      .run('Test Trip FK', '2026-08-01', '2026-08-10');
    const tripId = tripRes.lastInsertRowid as number;

    db.prepare('INSERT INTO trip_members (trip_id, user_id, created_at) VALUES (?, ?, ?)').run(
      tripId,
      targetId,
      '2026-08-01T00:00:00Z'
    );
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
    const item = db.prepare('SELECT owner_id FROM packing_items WHERE label = ?').get('Shirt') as {
      owner_id: number | null;
    };
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

  it('allows admin to toggle is_restricted on a user, but prevents self-restriction', async () => {
    const { db } = await import('../../src/db/index.js');
    const res = db
      .prepare(
        'INSERT INTO users (username, password_hash, avatar, is_restricted) VALUES (?, ?, ?, 1)'
      )
      .run('restricted_test_user', bcrypt.hashSync('pass', 10), '👤');
    const targetId = res.lastInsertRowid as number;

    // Admin unlocks user (is_restricted = false)
    const unlockRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/restricted`,
      headers: { cookie: adminCookie },
      payload: { is_restricted: false },
    });
    expect(unlockRes.statusCode).toBe(200);
    expect(unlockRes.json().is_restricted).toBe(false);

    // Admin restricts user again (is_restricted = true)
    const restrictRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/restricted`,
      headers: { cookie: adminCookie },
      payload: { is_restricted: true },
    });
    expect(restrictRes.statusCode).toBe(200);
    expect(restrictRes.json().is_restricted).toBe(true);

    // Self-restriction attempt
    const selfRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${adminId}/restricted`,
      headers: { cookie: adminCookie },
      payload: { is_restricted: true },
    });
    expect(selfRes.statusCode).toBe(400);
    expect(selfRes.json().error).toContain('eigenen Account');

    // Non-admin attempt rejected
    const nonAdminRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/restricted`,
      headers: { cookie: userCookie },
      payload: { is_restricted: false },
    });
    expect(nonAdminRes.statusCode).toBe(403);

    // Invalid body rejected
    const invalidBodyRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/restricted`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(invalidBodyRes.statusCode).toBe(400);

    // Cannot restrict another admin
    const restrictAdminRes = await app.inject({
      method: 'PUT',
      url: `/api/users/${adminId}/restricted`,
      headers: { cookie: adminCookie },
      payload: { is_restricted: true },
    });
    expect(restrictAdminRes.statusCode).toBe(400);
  });

  it('allows admin to change user role via PUT /api/users/:id/role', async () => {
    const { db } = await import('../../src/db/index.js');
    const res = db
      .prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)')
      .run('role_test_user', bcrypt.hashSync('pass', 10), '👤');
    const targetId = res.lastInsertRowid as number;

    // Change to restricted (Basis-Konto)
    const setRestricted = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'restricted' },
    });
    expect(setRestricted.statusCode).toBe(200);
    expect(setRestricted.json().is_restricted).toBe(true);
    expect(setRestricted.json().is_admin).toBe(false);

    // Change to plus
    const setPlus = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'plus' },
    });
    expect(setPlus.statusCode).toBe(200);
    expect(setPlus.json().is_restricted).toBe(false);
    expect(setPlus.json().is_admin).toBe(false);

    // Change to admin
    const setAdmin = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'admin' },
    });
    expect(setAdmin.statusCode).toBe(200);
    expect(setAdmin.json().is_admin).toBe(true);
    expect(setAdmin.json().is_restricted).toBe(false);

    // Self-restriction attempt rejected
    const selfRestrict = await app.inject({
      method: 'PUT',
      url: `/api/users/${adminId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'restricted' },
    });
    expect(selfRestrict.statusCode).toBe(400);
    expect(selfRestrict.json().error).toContain('eigenen Account');

    // Demoting the target user back to plus so only adminId remains
    await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'plus' },
    });

    // Sole admin self-demotion attempt rejected
    const selfDemote = await app.inject({
      method: 'PUT',
      url: `/api/users/${adminId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'plus' },
    });
    expect(selfDemote.statusCode).toBe(400);
    expect(selfDemote.json().error).toContain('letzte Administrator');

    // Invalid role rejected
    const invalidRole = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: adminCookie },
      payload: { role: 'superadmin' },
    });
    expect(invalidRole.statusCode).toBe(400);

    // Non-admin attempt rejected
    const nonAdmin = await app.inject({
      method: 'PUT',
      url: `/api/users/${targetId}/role`,
      headers: { cookie: userCookie },
      payload: { role: 'admin' },
    });
    expect(nonAdmin.statusCode).toBe(403);
  });

  it('allows admin to read and update registrationMode in instance_settings', async () => {
    // Read current mode
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/users/registration-mode',
      headers: { cookie: adminCookie },
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()).toHaveProperty('registrationMode');

    // Update mode to restricted
    const putRes = await app.inject({
      method: 'PUT',
      url: '/api/users/registration-mode',
      headers: { cookie: adminCookie },
      payload: { registrationMode: 'restricted' },
    });
    expect(putRes.statusCode).toBe(200);
    expect(putRes.json().registrationMode).toBe('restricted');

    // Public /auth/config should reflect the newly updated mode
    const configRes = await app.inject({
      method: 'GET',
      url: '/api/auth/config',
    });
    expect(configRes.statusCode).toBe(200);
    expect(configRes.json().registrationMode).toBe('restricted');

    // Non-admin rejected
    const nonAdminRes = await app.inject({
      method: 'PUT',
      url: '/api/users/registration-mode',
      headers: { cookie: userCookie },
      payload: { registrationMode: 'off' },
    });
    expect(nonAdminRes.statusCode).toBe(403);

    // Invalid mode rejected
    const invalidRes = await app.inject({
      method: 'PUT',
      url: '/api/users/registration-mode',
      headers: { cookie: adminCookie },
      payload: { registrationMode: 'invalid_mode' },
    });
    expect(invalidRes.statusCode).toBe(400);
  });

  describe('Admin Password Reset & Email Verification', () => {
    let testUserId: number;
    let testUserCookie: string;

    beforeAll(async () => {
      const { db } = await import('../../src/db/index.js');
      const res = db
        .prepare(
          'INSERT INTO users (username, email, password_hash, avatar, is_admin, is_email_verified, must_change_password) VALUES (?, ?, ?, ?, 0, 0, 0)'
        )
        .run('reset_test_user', 'reset_test@example.com', bcrypt.hashSync('oldpass123', 10), '🧑');
      testUserId = res.lastInsertRowid as number;

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'reset_test_user', password: 'oldpass123' },
      });
      testUserCookie = String(login.headers['set-cookie']);
    });

    it('rejects password reset for non-admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/users/${testUserId}/reset-password`,
        headers: { cookie: testUserCookie },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows admin to reset user password with generated temporary password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/users/${testUserId}/reset-password`,
        headers: { cookie: adminCookie },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.temporaryPassword).toBeDefined();
      expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(6);
      expect(data.resetUrl).toContain('/reset-password?token=');

      // Nutzer kann sich mit dem neuen temporären Passwort anmelden und must_change_password ist true
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'reset_test_user', password: data.temporaryPassword },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json().must_change_password).toBe(true);
    });

    it('allows admin to reset password with a specified password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/users/${testUserId}/reset-password`,
        headers: { cookie: adminCookie },
        payload: { temporaryPassword: 'NeuPasswort123!' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().temporaryPassword).toBe('NeuPasswort123!');

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'reset_test_user', password: 'NeuPasswort123!' },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json().must_change_password).toBe(true);
    });

    it('rejects email verification for non-admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/users/${testUserId}/verify-email`,
        headers: { cookie: testUserCookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('allows admin to manually verify user email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/users/${testUserId}/verify-email`,
        headers: { cookie: adminCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().is_email_verified).toBe(true);
    });
  });
});
