import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('User Settings Email routes (/api/users/me/email)', () => {
  let app: FastifyInstance;
  let userCookie: string;
  let userId: number;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');

    const res1 = db
      .prepare(
        'INSERT INTO users (username, email, password_hash, avatar, is_admin, is_email_verified, must_change_password) VALUES (?, ?, ?, ?, 0, 1, 0)'
      )
      .run('email_user', 'old_email@example.com', bcrypt.hashSync('userpass123', 10), '🐱');
    userId = res1.lastInsertRowid as number;

    db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar, is_admin, is_email_verified, must_change_password) VALUES (?, ?, ?, ?, 0, 1, 0)'
    ).run('other_user', 'existing_other@example.com', bcrypt.hashSync('otherpass123', 10), '🐶');

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'email_user', password: 'userpass123' },
    });
    userCookie = String(loginRes.headers['set-cookie']);
  });

  afterEach(() => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
  });

  describe('Validation & Direct update (without email verification required)', () => {
    it('rejects invalid email formats', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'not-valid' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Ungültige E-Mail-Adresse');
    });

    it('rejects email address already in use by another user', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'existing_other@example.com' },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('bereits verwendet');
    });

    it('rejects submitting identical verified email', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'old_email@example.com' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('bereits deine hinterlegte E-Mail-Adresse');
    });

    it('updates email directly when email verification is not required', async () => {
      const { db } = await import('../../src/db/index.js');
      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'direct_updated@example.com' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        requiresVerification: false,
        email: 'direct_updated@example.com',
        is_email_verified: true,
      });

      const row = db
        .prepare('SELECT email, is_email_verified FROM users WHERE id = ?')
        .get(userId) as {
        email: string;
        is_email_verified: number;
      };
      expect(row.email).toBe('direct_updated@example.com');
      expect(row.is_email_verified).toBe(1);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: userCookie },
      });
      expect(meRes.json().email).toBe('direct_updated@example.com');
      expect(meRes.json().pending_email).toBeNull();
    });
  });

  describe('Workflow with email verification (REQUIRE_EMAIL_VERIFICATION=true)', () => {
    it('creates verification token with pending_email and preserves existing email until verified', async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
      const { db } = await import('../../src/db/index.js');

      const res = await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'pending_new@example.com' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        requiresVerification: true,
        pendingEmail: 'pending_new@example.com',
        email: 'direct_updated@example.com',
      });

      // Existing email remains active
      const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as {
        email: string;
      };
      expect(userRow.email).toBe('direct_updated@example.com');

      // Token in email_verification_tokens has pending_email
      const tokenRow = db
        .prepare('SELECT * FROM email_verification_tokens WHERE user_id = ?')
        .get(userId) as { token_hash: string; pending_email: string };
      expect(tokenRow).toBeTruthy();
      expect(tokenRow.pending_email).toBe('pending_new@example.com');

      // GET /api/auth/me exposes pending_email
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: userCookie },
      });
      expect(meRes.json().email).toBe('direct_updated@example.com');
      expect(meRes.json().pending_email).toBe('pending_new@example.com');
    });

    it('resends verification email for pending email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/users/me/resend-verification-email',
        headers: { cookie: userCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toContain('pending_new@example.com');
    });

    it('cancels pending email change with DELETE /api/users/me/email-pending', async () => {
      const { db } = await import('../../src/db/index.js');

      const delRes = await app.inject({
        method: 'DELETE',
        url: '/api/users/me/email-pending',
        headers: { cookie: userCookie },
      });
      expect(delRes.statusCode).toBe(204);

      const tokens = db
        .prepare('SELECT * FROM email_verification_tokens WHERE user_id = ?')
        .all(userId);
      expect(tokens.length).toBe(0);

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: userCookie },
      });
      expect(meRes.json().pending_email).toBeNull();
    });

    it('completes email verification via POST /api/auth/verify-email', async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
      const { db } = await import('../../src/db/index.js');

      // Request email change again
      await app.inject({
        method: 'PUT',
        url: '/api/users/me/email',
        headers: { cookie: userCookie },
        payload: { email: 'verified_final@example.com' },
      });

      // Retrieve token from DB to simulate clicking the email link
      const rawToken = 'test-token-123456';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      db.prepare('DELETE FROM email_verification_tokens WHERE user_id = ?').run(userId);
      db.prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, pending_email, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, tokenHash, 'verified_final@example.com', expiresAt, new Date().toISOString());

      // Verify token
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: rawToken },
      });
      expect(verifyRes.statusCode).toBe(200);
      expect(verifyRes.json().success).toBe(true);

      // Verify that user record in DB is updated
      const updatedUser = db
        .prepare('SELECT email, is_email_verified FROM users WHERE id = ?')
        .get(userId) as {
        email: string;
        is_email_verified: number;
      };
      expect(updatedUser.email).toBe('verified_final@example.com');
      expect(updatedUser.is_email_verified).toBe(1);

      // Token is consumed
      const remainingTokens = db
        .prepare('SELECT * FROM email_verification_tokens WHERE user_id = ?')
        .all(userId);
      expect(remainingTokens.length).toBe(0);

      // Auth me reflects verified email and cleared pending_email
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: userCookie },
      });
      expect(meRes.json().email).toBe('verified_final@example.com');
      expect(meRes.json().pending_email).toBeNull();
    });

    it('rejects verification if pending email was taken by another user before confirmation', async () => {
      const { db } = await import('../../src/db/index.js');

      const rawToken = 'conflict-token-999';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // other_user has email 'existing_other@example.com'
      db.prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, pending_email, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(userId, tokenHash, 'existing_other@example.com', expiresAt, new Date().toISOString());

      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: rawToken },
      });
      expect(verifyRes.statusCode).toBe(409);
      expect(verifyRes.json().error).toContain('inzwischen von einem anderen Konto verwendet');
    });
  });
});
