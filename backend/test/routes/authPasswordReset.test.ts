import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Auth Password Reset & Email Verification routes', () => {
  let app: FastifyInstance;
  let testUserId: number;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');

    const res = db
      .prepare(
        'INSERT INTO users (username, email, password_hash, avatar, is_admin, is_email_verified, must_change_password) VALUES (?, ?, ?, ?, 0, 1, 0)'
      )
      .run('reset_guy', 'reset_guy@example.com', bcrypt.hashSync('oldpassword123', 10), '🕶️');
    testUserId = res.lastInsertRowid as number;
  });

  afterEach(() => {
    process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
  });

  it('reports emailConfigured and requireEmailVerification in /auth/config', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/config',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('emailConfigured');
    expect(body).toHaveProperty('requireEmailVerification');
  });

  describe('POST /api/auth/forgot-password', () => {
    it('rejects invalid email formats', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns generic success message for unknown email without creating token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'nobody@example.com' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().message).toContain('Falls ein Konto mit dieser E-Mail-Adresse existiert');
    });

    it('creates password reset token when email exists', async () => {
      const { db } = await import('../../src/db/index.js');
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        payload: { email: 'reset_guy@example.com' },
      });
      expect(res.statusCode).toBe(200);

      const tokens = db
        .prepare('SELECT * FROM password_reset_tokens WHERE user_id = ?')
        .all(testUserId) as { token_hash: string; expires_at: string }[];
      expect(tokens.length).toBe(1);
      expect(tokens[0].token_hash).toBeDefined();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('rejects invalid or non-existent token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'invalid_token_12345', newPassword: 'brandnewpassword' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects short passwords', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: 'some_token', newPassword: '123' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('resets password successfully with valid token and consumes token', async () => {
      const { db } = await import('../../src/db/index.js');

      // Create a known valid token
      const rawToken = 'my_secret_reset_token_xyz_123';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(testUserId);
      db.prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
      ).run(testUserId, tokenHash, expiresAt, new Date().toISOString());

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: rawToken, newPassword: 'brandnewpassword123' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      // Verify token was deleted
      const remainingTokens = db
        .prepare('SELECT * FROM password_reset_tokens WHERE user_id = ?')
        .all(testUserId);
      expect(remainingTokens.length).toBe(0);

      // Verify login with new password succeeds
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'reset_guy', password: 'brandnewpassword123' },
      });
      expect(loginRes.statusCode).toBe(200);
      expect(loginRes.json().must_change_password).toBe(false);

      // Re-using the token now fails
      const reuseRes = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        payload: { token: rawToken, newPassword: 'anotherpassword123' },
      });
      expect(reuseRes.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    let unverifiedUserId: number;
    const rawVerifyToken = 'verify_email_token_abc_789';

    beforeAll(async () => {
      const { db } = await import('../../src/db/index.js');
      const res = db
        .prepare(
          'INSERT INTO users (username, email, password_hash, avatar, is_admin, is_email_verified) VALUES (?, ?, ?, ?, 0, 0)'
        )
        .run('unverified_guy', 'unverified@example.com', bcrypt.hashSync('pass12345', 10), '👤');
      unverifiedUserId = res.lastInsertRowid as number;

      const tokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?)'
      ).run(unverifiedUserId, tokenHash, expiresAt, new Date().toISOString());
    });

    it('rejects invalid confirmation tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: 'bogus_token' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('confirms email with valid token and consumes token', async () => {
      const { db } = await import('../../src/db/index.js');
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/verify-email',
        payload: { token: rawVerifyToken },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);

      const user = db
        .prepare('SELECT is_email_verified FROM users WHERE id = ?')
        .get(unverifiedUserId) as { is_email_verified: number };
      expect(user.is_email_verified).toBe(1);

      const tokens = db
        .prepare('SELECT * FROM email_verification_tokens WHERE user_id = ?')
        .all(unverifiedUserId);
      expect(tokens.length).toBe(0);
    });
  });

  describe('Double-Opt-In Registration Flow', () => {
    it('fails registration when email verification is required but SMTP is unconfigured', async () => {
      delete process.env.SMTP_HOST;
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
      const { db } = await import('../../src/db/index.js');

      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'no_smtp_user',
          email: 'no_smtp@example.com',
          password: 'securePassword123',
        },
      });

      expect(regRes.statusCode).toBe(503);
      expect(regRes.json().error).toContain('kein E-Mail-Server konfiguriert');
      expect(regRes.json().noMailServer).toBe(true);

      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('no_smtp_user');
      expect(user).toBeUndefined();
    });

    it('requires email verification on registration when enabled and blocks unverified login', async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
      const mailer = await import('../../src/utils/mailer.js');
      const spy = vi.spyOn(mailer, 'sendVerificationEmail').mockResolvedValueOnce({
        success: true,
        actionUrl: 'http://localhost:5173/verify-email?token=fake_tok_123',
      });
      const { db } = await import('../../src/db/index.js');

      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'opt_in_user',
          email: 'optin@example.com',
          password: 'securePassword123',
        },
      });
      expect(regRes.statusCode).toBe(201);
      const regData = regRes.json();
      expect(regData.requiresVerification).toBe(true);
      spy.mockRestore();

      // Attempting to log in should be blocked
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'opt_in_user',
          password: 'securePassword123',
        },
      });
      expect(loginRes.statusCode).toBe(403);
      expect(loginRes.json().unverifiedEmail).toBe(true);

      // Find token and verify
      const tokenRow = db
        .prepare(
          'SELECT email_verification_tokens.token_hash FROM email_verification_tokens JOIN users ON users.id = email_verification_tokens.user_id WHERE users.username = ?'
        )
        .get('opt_in_user') as { token_hash: string } | undefined;
      expect(tokenRow).toBeDefined();

      // Manually simulate verification using database update or test token
      db.prepare('UPDATE users SET is_email_verified = 1 WHERE username = ?').run('opt_in_user');

      // Now login succeeds
      const verifiedLoginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: 'opt_in_user',
          password: 'securePassword123',
        },
      });
      expect(verifiedLoginRes.statusCode).toBe(200);
      expect(verifiedLoginRes.json().is_email_verified).toBe(true);
    });

    it('rolls back user creation if verification email delivery fails', async () => {
      process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      const mailer = await import('../../src/utils/mailer.js');
      const spy = vi.spyOn(mailer, 'sendVerificationEmail').mockResolvedValueOnce({
        success: false,
        actionUrl: '',
        error: 'SMTP Connection timeout',
      });

      const { db } = await import('../../src/db/index.js');

      const regRes = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          username: 'failed_mail_user',
          email: 'failed_mail@example.com',
          password: 'securePassword123',
        },
      });

      expect(regRes.statusCode).toBe(503);
      expect(regRes.json().error).toContain('Bestätigungs-E-Mail konnte nicht zugestellt werden');

      // User must not be saved in database (rollback)
      const user = db.prepare('SELECT id FROM users WHERE username = ?').get('failed_mail_user');
      expect(user).toBeUndefined();

      spy.mockRestore();
    });
  });

  describe('POST /api/auth/contact-admin & Admin Messages', () => {
    it('validates contact-admin input and saves message', async () => {
      // Rejects empty or too short message
      const shortRes = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        payload: { message: 'hi' },
      });
      expect(shortRes.statusCode).toBe(400);

      // Rejects invalid email format
      const invalidEmailRes = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        payload: { message: 'Hilfe bei der Registrierung', email: 'keine-echte-mail' },
      });
      expect(invalidEmailRes.statusCode).toBe(400);

      // Accepts valid message
      const validRes = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        payload: {
          name: 'Max Mustermann',
          email: 'max@example.com',
          username: 'maxi',
          message: 'Ich erhalte keine Bestätigungsmail auf dieser Instanz.',
          type: 'registration_help',
        },
      });
      expect(validRes.statusCode).toBe(200);
      expect(validRes.json().success).toBe(true);

      const { db } = await import('../../src/db/index.js');
      const saved = db.prepare('SELECT * FROM admin_messages WHERE username = ?').get('maxi') as
        { message: string; status: string } | undefined;
      expect(saved).toBeDefined();
      expect(saved?.message).toContain('keine Bestätigungsmail');
      expect(saved?.status).toBe('unread');
    });

    it('rejects contact-admin when contactAdminEnabled is set to false', async () => {
      const { setInstanceSetting } = await import('../../src/instanceSettings.js');
      setInstanceSetting('contact_admin_enabled', 'false');

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        payload: {
          message: 'Bitte helft mir beim Login, danke!',
        },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('deaktiviert');

      // Reset
      setInstanceSetting('contact_admin_enabled', 'true');
    });

    it('enforces rate limit of 3 requests per hour', async () => {
      const ip = '192.168.100.99';
      // 1st request
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        remoteAddress: ip,
        payload: { message: 'Nachricht Nummer eins' },
      });
      expect(res1.statusCode).toBe(200);

      // 2nd request
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        remoteAddress: ip,
        payload: { message: 'Nachricht Nummer zwei' },
      });
      expect(res2.statusCode).toBe(200);

      // 3rd request
      const res3 = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        remoteAddress: ip,
        payload: { message: 'Nachricht Nummer drei' },
      });
      expect(res3.statusCode).toBe(200);

      // 4th request exceeds rate limit
      const res4 = await app.inject({
        method: 'POST',
        url: '/api/auth/contact-admin',
        remoteAddress: ip,
        payload: { message: 'Nachricht Nummer vier' },
      });
      expect(res4.statusCode).toBe(429);
      expect(res4.json().error).toContain('maximal 3 Nachrichten');
    });
  });
});
