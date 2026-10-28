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
    // Port 465 nutzt direktes TLS/SSL (SMTPS / Implicit TLS).
    // Port 587, 25 und 2525 nutzen STARTTLS (Explicit TLS).
    // Wenn "TLS/SSL erzwingen" auf Port 587/25/2525 aktiviert ist, verlangen wir requireTLS: true,
    // erzwingen aber keinen direkten SSL-Handshake vor dem SMTP-Banner (verhindert Hänger).
    const isExplicitTlsPort = port === 587 || port === 25 || port === 2525;
    const secure = port === 465 || (forceSecureSetting && !isExplicitTlsPort);
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

  const html = buildEmailHtml({
    title: 'Passwort zurücksetzen',
    greeting: `Hallo <strong>${escapeHtml(params.username)}</strong>,`,
    messageHtml:
      '<p style="margin: 0 0 16px 0;">du hast eine Anfrage zum Zurücksetzen deines Passworts für deinen Reisotor-Account gestellt.</p>',
    actionUrl: resetUrl,
    actionLabel: 'Neues Passwort vergeben',
    hintHtml:
      'Dieser Link ist <strong>1 Stunde</strong> lang gültig.<br>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren. Dein Passwort bleibt unverändert.',
  });

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
    ? buildEmailHtml({
        title: 'Neue E-Mail-Adresse bestätigen',
        greeting: `Hallo <strong>${escapeHtml(params.username)}</strong>,`,
        messageHtml:
          '<p style="margin: 0 0 16px 0;">du hast die Änderung deiner E-Mail-Adresse für deinen Reisotor-Account angefordert. Bitte bestätige deine neue Adresse, um die Änderung abzuschließen.</p>',
        actionUrl: verifyUrl,
        actionLabel: 'Neue E-Mail-Adresse bestätigen',
        hintHtml:
          'Dieser Link ist <strong>24 Stunden</strong> lang gültig.<br>Falls du diese Änderung nicht veranlasst hast, bleibt deine bisherige E-Mail-Adresse unverändert.',
      })
    : buildEmailHtml({
        title: 'Willkommen bei Reisotor!',
        greeting: `Hallo <strong>${escapeHtml(params.username)}</strong>,`,
        messageHtml:
          '<p style="margin: 0 0 16px 0;">bitte bestätige deine E-Mail-Adresse, um deinen Reisotor-Account zu aktivieren.</p>',
        actionUrl: verifyUrl,
        actionLabel: 'E-Mail-Adresse bestätigen',
        hintHtml:
          'Dieser Link ist <strong>24 Stunden</strong> lang gültig.<br>Falls du dieses Benutzerkonto nicht angelegt hast, kannst du diese Nachricht einfach ignorieren.',
      });

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

  const html = buildEmailHtml({
    title: 'Reisotor Test-E-Mail',
    badgeText: 'Erfolgreich verbunden',
    greeting: 'Hallo,',
    messageHtml:
      '<p style="margin: 0 0 16px 0;">dies ist eine Test-E-Mail deiner Reisotor-Instanz.</p><p style="margin: 0;">Wenn du diese Nachricht liest, ist deine SMTP-Konfiguration (Host, Port, Authentifizierung und Absenderadresse) voll funktionsfähig!</p>',
    hintHtml:
      'Diese Test-E-Mail wurde über die SMTP-Einstellungen deiner Reisotor-Instanz versendet.',
  });

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

export const DEFAULT_FALLBACK_LOGO_URL =
  'https://raw.githubusercontent.com/dmstern/reisotor/main/frontend/public/icons/icon-192.png';

export function getLogoUrl(): string {
  const customLogo = getEffectiveSetting('email_logo_url', 'EMAIL_LOGO_URL').trim();
  if (customLogo) return customLogo;

  const baseUrl = getAppUrl();
  const isLocalOrPrivate =
    !baseUrl.startsWith('https://') ||
    baseUrl.includes('localhost') ||
    baseUrl.includes('127.0.0.1') ||
    baseUrl.includes('.local');

  if (isLocalOrPrivate) {
    return DEFAULT_FALLBACK_LOGO_URL;
  }
  return `${baseUrl}/icons/icon-192.png`;
}

interface EmailTemplateData {
  title: string;
  greeting?: string;
  messageHtml: string;
  actionUrl?: string;
  actionLabel?: string;
  hintHtml?: string;
  badgeText?: string;
}

function buildEmailHtml(data: EmailTemplateData): string {
  const baseUrl = getAppUrl();
  const logoUrl = getLogoUrl();
  const domainDisplay = baseUrl.replace(/^https?:\/\//, '');

  const badgeHtml = data.badgeText
    ? `<div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; background-color: #ecfdf5; color: #166534; border: 1px solid #bbf7d0; padding: 4px 14px; border-radius: 9999px; font-weight: 600; font-size: 13px;">
          ${escapeHtml(data.badgeText)}
        </span>
      </div>`
    : '';

  const greetingHtml = data.greeting
    ? `<p style="font-size: 15px; line-height: 1.6; color: #2b2a28; margin: 0 0 16px 0;">${data.greeting}</p>`
    : '';

  const actionButtonHtml =
    data.actionUrl && data.actionLabel
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0 28px 0;">
          <tr>
            <td align="center">
              <a href="${data.actionUrl}" class="email-btn" target="_blank" rel="noopener" style="display: inline-block; background-color: #9141ac; color: #ffffff !important; font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; text-decoration: none; padding: 13px 32px; border-radius: 9999px; box-shadow: 0 3px 10px rgba(145, 65, 172, 0.25); text-align: center; -webkit-text-size-adjust: none;">
                ${escapeHtml(data.actionLabel)}
              </a>
            </td>
          </tr>
        </table>
        <div style="background-color: #faf8f5; border: 1px solid #e8e2d9; border-radius: 10px; padding: 14px 16px; margin: 24px 0 20px 0; font-size: 13px; color: #66625b; line-height: 1.5;">
          <span style="font-weight: 500; color: #2b2a28; display: block; margin-bottom: 4px;">Oder kopiere diesen Link in deinen Browser:</span>
          <a href="${data.actionUrl}" target="_blank" rel="noopener" style="color: #9141ac; text-decoration: underline; word-break: break-all; font-size: 12px;">${data.actionUrl}</a>
        </div>`
      : '';

  const hintBlockHtml = data.hintHtml
    ? `<div style="border-top: 1px solid #e8e2d9; padding-top: 16px; margin-top: 24px; font-size: 13px; color: #66625b; line-height: 1.5;">
        ${data.hintHtml}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(data.title)}</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; min-width: 100%; background-color: #faf8f5; font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2b2a28; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .email-card-content { padding: 20px 18px 24px 18px !important; }
      .email-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 32px 16px; background-color: #faf8f5; font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2b2a28; -webkit-font-smoothing: antialiased;">
  <center style="width: 100%; background-color: #faf8f5;">
    <div class="email-container" style="max-width: 520px; margin: 0 auto; text-align: left;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e8e2d9; overflow: hidden; box-shadow: 0 4px 16px rgba(43, 42, 40, 0.04); border-collapse: separate;">
        <tr>
          <td style="height: 5px; background-color: #9141ac; background-image: linear-gradient(90deg, #9141ac 0%, #e08e45 100%); line-height: 5px; font-size: 5px;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding: 28px 32px 16px 32px; text-align: center;">
            <a href="${baseUrl}" target="_blank" rel="noopener" style="text-decoration: none; display: inline-block;">
              <div style="display: inline-block; width: 52px; height: 52px; border-radius: 14px; background-color: #faf8f5; border: 1px solid #e8e2d9; overflow: hidden; margin-bottom: 8px;">
                <img src="${logoUrl}" width="52" height="52" alt="Reisotor" style="display: block; width: 52px; height: 52px; max-width: 52px; border: 0; outline: none; text-decoration: none;" />
              </div>
              <span style="font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700; color: #2b2a28; letter-spacing: -0.3px; display: block;">Reisotor</span>
            </a>
            <div style="font-size: 13px; color: #66625b; margin-top: 3px; font-weight: 400;">Gemeinsam reisen und planen</div>
          </td>
        </tr>
        <tr>
          <td class="email-card-content" style="padding: 8px 32px 32px 32px;">
            ${badgeHtml}
            <h1 style="font-family: 'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 600; color: #9141ac; margin: 0 0 16px 0; text-align: center;">
              ${escapeHtml(data.title)}
            </h1>
            ${greetingHtml}
            <div style="font-size: 15px; line-height: 1.6; color: #2b2a28;">
              ${data.messageHtml}
            </div>
            ${actionButtonHtml}
            ${hintBlockHtml}
          </td>
        </tr>
      </table>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 20px;">
        <tr>
          <td style="text-align: center; font-size: 12px; color: #8c877e; line-height: 1.6;">
            Diese E-Mail wurde automatisch von Reisotor versendet.<br>
            <a href="${baseUrl}" target="_blank" rel="noopener" style="color: #9141ac; text-decoration: none; font-weight: 500;">${domainDisplay}</a>
          </td>
        </tr>
      </table>
    </div>
  </center>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
