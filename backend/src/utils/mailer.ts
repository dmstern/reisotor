import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { getEffectiveSetting } from '../instanceSettings.js';

let transporterInstance: Transporter | null = null;

export function isEmailConfigured(): boolean {
  const host = getEffectiveSetting('smtp_host', 'SMTP_HOST').trim();
  return Boolean(host);
}

export function isEmailVerificationRequired(): boolean {
  return (
    getEffectiveSetting('require_email_verification', 'REQUIRE_EMAIL_VERIFICATION', 'false') ===
    'true'
  );
}

export function getAppUrl(): string {
  const url =
    getEffectiveSetting('app_url', 'APP_URL') || process.env.BASE_URL || 'http://localhost:5173';
  return url.replace(/\/+$/, '');
}

function getFromAddress(): string {
  const customFrom = getEffectiveSetting('smtp_from', 'SMTP_FROM').trim();
  if (customFrom) return customFrom;
  const user = getEffectiveSetting('smtp_user', 'SMTP_USER').trim();
  return `"Reisotor" <${user || 'noreply@reisotor.local'}>`;
}

function getTransporter(): Transporter | null {
  if (!isEmailConfigured()) {
    return null;
  }
  if (!transporterInstance) {
    const host = getEffectiveSetting('smtp_host', 'SMTP_HOST').trim();
    const port = Number(getEffectiveSetting('smtp_port', 'SMTP_PORT', '587')) || 587;
    const secure =
      getEffectiveSetting('smtp_secure', 'SMTP_SECURE', 'false') === 'true' || port === 465;
    const user = getEffectiveSetting('smtp_user', 'SMTP_USER').trim();
    const pass = getEffectiveSetting('smtp_pass', 'SMTP_PASS').trim();

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
    });
  }
  return transporterInstance;
}

export function resetTransporterForTesting(): void {
  transporterInstance = null;
}

export interface SendMailResult {
  success: boolean;
  actionUrl: string;
  simulated?: boolean;
  error?: string;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  username: string;
  token: string;
}): Promise<SendMailResult> {
  const baseUrl = getAppUrl();
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(params.token)}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.info(
      `[Mailer] SMTP nicht konfiguriert. Passwort-Reset-Link für ${params.to}: ${resetUrl}`
    );
    return { success: true, actionUrl: resetUrl, simulated: true };
  }

  const from = getFromAddress();
  const subject = 'Passwort zurücksetzen – Reisotor';

  const text = `Hallo ${params.username},

du hast eine Anfrage zum Zurücksetzen deines Passworts für deinen Reisotor-Account gestellt.

Klicke auf den folgenden Link, um ein neues Passwort zu vergeben:
${resetUrl}

Dieser Link ist 1 Stunde lang gültig.

Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.

Viele Grüße,
dein Reisotor-Team`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
    .card { background-color: #ffffff; border-radius: 12px; padding: 32px; max-width: 520px; margin: 0 auto; border: 1px solid #d0d7de; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { font-size: 20px; margin-top: 0; margin-bottom: 16px; color: #0969da; }
    p { font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #0969da; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 12px 0 24px 0; }
    .hint { font-size: 13px; color: #57604a; border-top: 1px solid #eaeef2; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Reisotor Passwort zurücksetzen</h1>
    <p>Hallo <strong>${escapeHtml(params.username)}</strong>,</p>
    <p>du hast eine Anfrage zum Zurücksetzen deines Passworts für deinen Reisotor-Account gestellt.</p>
    <p><a href="${resetUrl}" class="btn" target="_blank" rel="noopener">Neues Passwort vergeben</a></p>
    <p>Oder kopiere diesen Link in deinen Browser:<br><small style="word-break: break-all;">${resetUrl}</small></p>
    <p class="hint">Dieser Link ist <strong>1 Stunde</strong> lang gültig.<br>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });
    return { success: true, actionUrl: resetUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Mailer] Fehler beim Versenden der Passwort-Reset-Mail an ${params.to}:`,
      errorMsg
    );
    return { success: false, actionUrl: resetUrl, error: errorMsg };
  }
}

export async function sendVerificationEmail(params: {
  to: string;
  username: string;
  token: string;
}): Promise<SendMailResult> {
  const baseUrl = getAppUrl();
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(params.token)}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.info(
      `[Mailer] SMTP nicht konfiguriert. E-Mail-Bestätigungslink für ${params.to}: ${verifyUrl}`
    );
    return { success: true, actionUrl: verifyUrl, simulated: true };
  }

  const from = getFromAddress();
  const subject = 'E-Mail-Adresse bestätigen – Reisotor';

  const text = `Hallo ${params.username},

willkommen bei Reisotor! Bitte bestätige deine E-Mail-Adresse, um dein Benutzerkonto zu aktivieren.

Klicke auf den folgenden Link:
${verifyUrl}

Dieser Link ist 24 Stunden lang gültig.

Viele Grüße,
dein Reisotor-Team`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
    .card { background-color: #ffffff; border-radius: 12px; padding: 32px; max-width: 520px; margin: 0 auto; border: 1px solid #d0d7de; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { font-size: 20px; margin-top: 0; margin-bottom: 16px; color: #0969da; }
    p { font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #0969da; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 12px 0 24px 0; }
    .hint { font-size: 13px; color: #57604a; border-top: 1px solid #eaeef2; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Willkommen bei Reisotor!</h1>
    <p>Hallo <strong>${escapeHtml(params.username)}</strong>,</p>
    <p>bitte bestätige deine E-Mail-Adresse, um deinen Reisotor-Account zu aktivieren.</p>
    <p><a href="${verifyUrl}" class="btn" target="_blank" rel="noopener">E-Mail-Adresse bestätigen</a></p>
    <p>Oder kopiere diesen Link in deinen Browser:<br><small style="word-break: break-all;">${verifyUrl}</small></p>
    <p class="hint">Dieser Link ist <strong>24 Stunden</strong> lang gültig.</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
      html,
    });
    return { success: true, actionUrl: verifyUrl };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[Mailer] Fehler beim Versenden der Bestätigungs-Mail an ${params.to}:`,
      errorMsg
    );
    return { success: false, actionUrl: verifyUrl, error: errorMsg };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
