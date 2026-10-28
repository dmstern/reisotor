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
    getEffectiveSetting('app_url', 'APP_URL') ||
    (process.env.BASE_URL && process.env.BASE_URL.startsWith('http') ? process.env.BASE_URL : '') ||
    'http://localhost:5173';
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
    const forceSecureSetting =
      getEffectiveSetting('smtp_secure', 'SMTP_SECURE', 'false') === 'true';
    // Port 465 nutzt direktes TLS/SSL (SMTPS).
    // Port 587 und 25 nutzen STARTTLS (secure = false).
    // Wenn "TLS/SSL erzwingen" auf Port 587 aktiviert ist, verlangen wir requireTLS: true,
    // erzwingen aber keinen direkten SSL-Handshake vor dem SMTP-Banner (verhindert Hänger).
    const secure = port === 465 || (forceSecureSetting && port !== 587 && port !== 25);
    const requireTLS = forceSecureSetting && !secure;
    const user = getEffectiveSetting('smtp_user', 'SMTP_USER').trim();
    const pass = getEffectiveSetting('smtp_pass', 'SMTP_PASS').trim();

    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: requireTLS || undefined,
      auth:
        user && pass
          ? {
              user,
              pass,
            }
          : undefined,
      connectionTimeout: 7000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return transporterInstance;
}

export function resetTransporter(): void {
  transporterInstance = null;
}

export const resetTransporterForTesting = resetTransporter;

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
  isChange?: boolean;
}): Promise<SendMailResult> {
  const baseUrl = getAppUrl();
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(params.token)}`;

  const transporter = getTransporter();
  if (!transporter) {
    const actionLabel = params.isChange ? 'E-Mail-Änderungslink' : 'E-Mail-Bestätigungslink';
    console.info(`[Mailer] SMTP nicht konfiguriert. ${actionLabel} für ${params.to}: ${verifyUrl}`);
    return { success: true, actionUrl: verifyUrl, simulated: true };
  }

  const from = getFromAddress();
  const subject = params.isChange
    ? 'Neue E-Mail-Adresse bestätigen – Reisotor'
    : 'E-Mail-Adresse bestätigen – Reisotor';

  const text = params.isChange
    ? `Hallo ${params.username},

du hast die Änderung deiner E-Mail-Adresse für deinen Reisotor-Account angefordert.

Klicke auf den folgenden Link, um deine neue E-Mail-Adresse zu bestätigen:
${verifyUrl}

Dieser Link ist 24 Stunden lang gültig.

Falls du diese Änderung nicht veranlasst hast, kannst du diese E-Mail ignorieren. Deine bisherige E-Mail-Adresse bleibt unverändert.

Viele Grüße,
dein Reisotor-Team`
    : `Hallo ${params.username},

willkommen bei Reisotor! Bitte bestätige deine E-Mail-Adresse, um dein Benutzerkonto zu aktivieren.

Klicke auf den folgenden Link:
${verifyUrl}

Dieser Link ist 24 Stunden lang gültig.

Viele Grüße,
dein Reisotor-Team`;

  const html = params.isChange
    ? `<!DOCTYPE html>
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
    <h1>Neue E-Mail-Adresse bestätigen</h1>
    <p>Hallo <strong>${escapeHtml(params.username)}</strong>,</p>
    <p>du hast die Änderung deiner E-Mail-Adresse für deinen Reisotor-Account angefordert. Bitte bestätige deine neue Adresse, um die Änderung abzuschließen.</p>
    <p><a href="${verifyUrl}" class="btn" target="_blank" rel="noopener">Neue E-Mail-Adresse bestätigen</a></p>
    <p>Oder kopiere diesen Link in deinen Browser:<br><small style="word-break: break-all;">${verifyUrl}</small></p>
    <p class="hint">Dieser Link ist <strong>24 Stunden</strong> lang gültig.<br>Falls du diese Änderung nicht veranlasst hast, bleibt deine bisherige E-Mail-Adresse unverändert.</p>
  </div>
</body>
</html>`
    : `<!DOCTYPE html>
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

export async function sendTestEmail(params: { to: string }): Promise<SendMailResult> {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, actionUrl: '', error: 'SMTP ist nicht konfiguriert' };
  }

  const from = getFromAddress();
  const subject = 'Test-E-Mail – Reisotor';
  const text = `Hallo,

dies ist eine Test-E-Mail deiner Reisotor-Instanz.
Wenn du diese Nachricht liest, ist deine SMTP-Konfiguration (Host, Port, Authentifizierung und Absenderadresse) voll funktionsfähig!

Viele Grüße,
dein Reisotor-Server`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fa; margin: 0; padding: 24px; color: #24292f; }
    .card { background-color: #ffffff; border-radius: 12px; padding: 32px; max-width: 520px; margin: 0 auto; border: 1px solid #d0d7de; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { font-size: 20px; margin-top: 0; margin-bottom: 16px; color: #0969da; }
    p { font-size: 15px; line-height: 1.6; margin-bottom: 20px; }
    .badge { display: inline-block; background-color: #dafbe1; color: #1a7f37; padding: 6px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Erfolgreich verbunden</span>
    <h1>Reisotor Test-E-Mail</h1>
    <p>Hallo,</p>
    <p>dies ist eine Test-E-Mail deiner Reisotor-Instanz.</p>
    <p>Wenn du diese Nachricht liest, ist deine SMTP-Konfiguration (Host, Port, Authentifizierung und Absenderadresse) voll funktionsfähig!</p>
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
    return { success: true, actionUrl: '' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Mailer] Fehler beim Versenden der Test-E-Mail an ${params.to}:`, errorMsg);
    return { success: false, actionUrl: '', error: errorMsg };
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
