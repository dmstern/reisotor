import '../helpers/initMemoryDb.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
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

  it('renders customized Reisotor branding in verification email HTML', async () => {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
    process.env.SMTP_USER = 'brevo-user';
    process.env.SMTP_PASS = 'brevo-pass';
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: '123' });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
    } as unknown as nodemailer.Transporter);

    const result = await sendVerificationEmail({
      to: 'daniel@example.com',
      username: 'Daniel <script>',
      token: 'tok-xyz',
    });

    expect(result.success).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailOptions = sendMailMock.mock.calls[0][0];

    expect(mailOptions.to).toBe('daniel@example.com');
    expect(mailOptions.subject).toBe('E-Mail-Adresse bestätigen – Reisotor');
    // Escapes special characters
    expect(mailOptions.html).toContain('Daniel &lt;script&gt;');
    // Reisotor brand identity & tokens
    expect(mailOptions.html).toContain('Willkommen bei Reisotor!');
    expect(mailOptions.html).toContain('Reisotor');
    expect(mailOptions.html).toContain('Gemeinsam reisen und planen');
    expect(mailOptions.html).toContain('#9141ac');
    expect(mailOptions.html).toContain('E-Mail-Adresse bestätigen');
    expect(mailOptions.html).toContain('/verify-email?token=tok-xyz');
    expect(mailOptions.html).toContain('/icons/icon-192.png');
  });

  it('renders customized Reisotor branding in test email HTML', async () => {
    process.env.SMTP_HOST = 'smtp-relay.brevo.com';
    process.env.SMTP_USER = 'brevo-user';
    process.env.SMTP_PASS = 'brevo-pass';
    const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test-123' });
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: sendMailMock,
    } as unknown as nodemailer.Transporter);

    const result = await sendTestEmail({ to: 'admin@example.com' });
    expect(result.success).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const mailOptions = sendMailMock.mock.calls[0][0];

    expect(mailOptions.subject).toBe('Test-E-Mail – Reisotor');
    expect(mailOptions.html).toContain('Reisotor Test-E-Mail');
    expect(mailOptions.html).toContain('Erfolgreich verbunden');
    expect(mailOptions.html).toContain('#9141ac');
  });
});
