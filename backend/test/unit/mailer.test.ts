import '../helpers/initMemoryDb.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isEmailConfigured,
  isEmailVerificationRequired,
  getAppUrl,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendTestEmail,
  resetTransporterForTesting,
} from '../../src/utils/mailer.js';

describe('Mailer utility', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetTransporterForTesting();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetTransporterForTesting();
  });

  it('detects when email is configured or not', () => {
    delete process.env.SMTP_HOST;
    expect(isEmailConfigured()).toBe(false);

    process.env.SMTP_HOST = 'smtp.example.com';
    expect(isEmailConfigured()).toBe(true);
  });

  it('detects when email verification is required', () => {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    expect(isEmailVerificationRequired()).toBe(false);

    process.env.REQUIRE_EMAIL_VERIFICATION = 'true';
    expect(isEmailVerificationRequired()).toBe(true);
  });

  it('computes clean app base URL without trailing slash', () => {
    process.env.APP_URL = 'https://reise.ruebenherz.de/';
    expect(getAppUrl()).toBe('https://reise.ruebenherz.de');

    delete process.env.APP_URL;
    process.env.BASE_URL = 'https://custom.example.com///';
    expect(getAppUrl()).toBe('https://custom.example.com');
  });

  it('simulates password reset email gracefully when SMTP is unconfigured', async () => {
    delete process.env.SMTP_HOST;
    const result = await sendPasswordResetEmail({
      to: 'test@example.com',
      username: 'testuser',
      token: 'tok123',
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.actionUrl).toContain('/reset-password?token=tok123');
  });

  it('simulates email verification gracefully when SMTP is unconfigured', async () => {
    delete process.env.SMTP_HOST;
    const result = await sendVerificationEmail({
      to: 'test@example.com',
      username: 'testuser',
      token: 'tok456',
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.actionUrl).toContain('/verify-email?token=tok456');
  });

  it('simulates email change verification gracefully when SMTP is unconfigured', async () => {
    delete process.env.SMTP_HOST;
    const result = await sendVerificationEmail({
      to: 'new@example.com',
      username: 'testuser',
      token: 'tok789',
      isChange: true,
    });
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.actionUrl).toContain('/verify-email?token=tok789');
  });

  it('fails sendTestEmail when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    const result = await sendTestEmail({ to: 'admin@example.com' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('SMTP ist nicht konfiguriert');
  });
});
