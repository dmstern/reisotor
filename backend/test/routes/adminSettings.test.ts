import { beforeAll, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('Admin Settings routes (/api/admin/settings)', () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    ({ app } = await buildTestApp());
    const { db } = await import('../../src/db/index.js');

    db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 1, 0)'
    ).run('settings_admin', 'admin@example.com', bcrypt.hashSync('adminpass', 10), '👑');

    db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar, is_admin, must_change_password) VALUES (?, ?, ?, ?, 0, 0)'
    ).run('settings_user', 'user@example.com', bcrypt.hashSync('userpass', 10), '🧑');

    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'settings_admin', password: 'adminpass' },
    });
    adminCookie = String(loginAdmin.headers['set-cookie']);

    const loginUser = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'settings_user', password: 'userpass' },
    });
    userCookie = String(loginUser.headers['set-cookie']);
  });

  it('rejects GET /api/admin/settings for non-admin users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows admin to fetch settings with masked secrets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.settings).toBeDefined();
    expect(body.settings.registration).toBeDefined();
    expect(body.settings.legal).toBeDefined();
    expect(body.settings.geo).toBeDefined();
    expect(body.settings.email).toBeDefined();
    expect(body.settings.feedback).toBeDefined();
    expect(body.settings.push).toBeDefined();
    // Secrets should not be exposed as plain text
    expect(body.settings.email.smtpPass).toBeUndefined();
    expect(typeof body.settings.email.isSmtpPassSet).toBe('boolean');
    expect(typeof body.settings.geo.isOrsApiKeySet).toBe('boolean');
  });

  it('rejects PUT /api/admin/settings for non-admin users', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: userCookie },
      payload: { legal: { operatorName: 'Hack Corp' } },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows admin to update settings and reflects updates across services', async () => {
    const updateRes = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload: {
        legal: {
          operatorName: 'Muster-Reisen GmbH',
          operatorAddress: 'Hauptstr. 10\n10115 Berlin',
          contactEmail: 'kontakt@muster-reisen.de',
          contactPhone: '+49 30 123456',
          hostingLocation: 'München',
        },
        geo: {
          orsApiKey: 'test-ors-key-12345',
          nominatimEnabled: false,
        },
        email: {
          smtpHost: 'smtp.mailtrap.io',
          smtpPort: 2525,
          smtpUser: 'myuser',
          smtpPass: 'supersecretpass',
        },
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().settings;
    expect(updated.legal.operatorName).toBe('Muster-Reisen GmbH');
    expect(updated.legal.hostingLocation).toBe('München');
    expect(updated.geo.isOrsApiKeySet).toBe(true);
    expect(updated.geo.nominatimEnabled).toBe(false);
    expect(updated.email.smtpHost).toBe('smtp.mailtrap.io');
    expect(updated.email.smtpPort).toBe(2525);
    expect(updated.email.isSmtpPassSet).toBe(true);

    // Verify GET /api/legal reflects updated operator and hosting location
    const legalRes = await app.inject({
      method: 'GET',
      url: '/api/legal',
    });
    expect(legalRes.statusCode).toBe(200);
    const legalBody = legalRes.json();
    expect(legalBody.operator.name).toBe('Muster-Reisen GmbH');
    expect(legalBody.hostingLocation).toBe('München');
    expect(legalBody.services.orsConfigured).toBe(true);
    expect(legalBody.services.nominatimEnabled).toBe(false);

    // Verify GET /api/build-info reflects hosting location
    const buildRes = await app.inject({
      method: 'GET',
      url: '/api/build-info',
      headers: { cookie: adminCookie },
    });
    expect(buildRes.statusCode).toBe(200);
    expect(buildRes.json().hostingLocation).toBe('München');
  });

  it('allows clearing secrets using clear flags and resets empty strings to defaults', async () => {
    const clearRes = await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload: {
        legal: { hostingLocation: '' },
        geo: { clearOrsApiKey: true },
        email: { clearSmtpPass: true, appUrl: '' },
      },
    });
    expect(clearRes.statusCode).toBe(200);
    const updated = clearRes.json().settings;
    expect(updated.legal.hostingLocation).toBe('Berlin'); // Fallback to default
    expect(updated.geo.isOrsApiKeySet).toBe(false);
    expect(updated.email.isSmtpPassSet).toBe(false);
    expect(updated.email.appUrl).toBe('http://localhost:5173');
  });

  it('allows generating VAPID keys on demand', async () => {
    const genRes = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/vapid-generate',
      headers: { cookie: adminCookie },
      payload: { subject: 'mailto:admin@domain.tld' },
    });
    expect(genRes.statusCode).toBe(200);
    const body = genRes.json();
    expect(body.publicKey).toBeDefined();
    expect(body.publicKey.length).toBeGreaterThan(20);
    expect(body.isPrivateKeySet).toBe(true);

    // Verify GET /api/admin/settings now sees VAPID key configured
    const checkRes = await app.inject({
      method: 'GET',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
    });
    const settings = checkRes.json().settings;
    expect(settings.push.vapidPublicKey).toBe(body.publicKey);
    expect(settings.push.isVapidPrivateKeySet).toBe(true);
    expect(settings.push.vapidSubject).toBe('mailto:admin@domain.tld');
  });

  it('rejects POST /api/admin/settings/send-test-email for non-admin users', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/send-test-email',
      headers: { cookie: userCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when sending test email without SMTP configured', async () => {
    delete process.env.SMTP_HOST;
    // Clear smtp_host in db
    await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload: { email: { smtpHost: '' } },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/send-test-email',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('SMTP-Server ist nicht konfiguriert');
  });

  it('returns 400 when admin profile has no email and no recipient specified', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/admin/settings',
      headers: { cookie: adminCookie },
      payload: {
        email: { smtpHost: 'smtp.example.com', smtpFrom: 'Reisotor <admin-fallback@example.com>' },
      },
    });

    const { db } = await import('../../src/db/index.js');
    db.prepare('UPDATE users SET email = NULL WHERE username = ?').run('settings_admin');

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/send-test-email',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain(
      'In deinem Benutzerprofil ist keine E-Mail-Adresse hinterlegt'
    );
  });

  it('allows sending test email to specified recipient even if profile has no email', async () => {
    const mailer = await import('../../src/utils/mailer.js');
    const spy = vi
      .spyOn(mailer, 'sendTestEmail')
      .mockResolvedValueOnce({ success: true, actionUrl: '' });

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/send-test-email',
      headers: { cookie: adminCookie },
      payload: { to: 'custom-recipient@example.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    expect(spy).toHaveBeenCalledWith({ to: 'custom-recipient@example.com' });
    spy.mockRestore();
  });

  it('returns 400 when specified recipient email is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/settings/send-test-email',
      headers: { cookie: adminCookie },
      payload: { to: 'invalid-email' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('ungültig');
  });
});
